import { NextResponse } from 'next/server'
import connectToDatabase from '@/lib/mongodb'
import DailyEntry from '@/models/DailyEntry'
import Task from '@/models/Task'
import { getAuthUser, getTodayKolkata } from '@/lib/auth'
import { sendNotifications } from '@/lib/notifications'
import { parseTimeInput } from '@/lib/timeFormat'
import { applyEmployeeSubmission, aggregateAssigneeProgress, ensureAssigneeProgress } from '@/lib/assigneeProgress'
import Flag from '@/models/Flag'
import Employee from '@/models/Employee'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  try {
    const user = await getAuthUser(req)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    await connectToDatabase()
    const { searchParams } = new URL(req.url)
    const date = searchParams.get('date')
    const projectId = searchParams.get('projectId')
    const flagged = searchParams.get('flagged')
    const employeeId = searchParams.get('employeeId')

    let query: any = {}

    if (user.role === 'Employee') {
      query.employeeId = user._id.toString()
    } else if (user.role === 'Project Head') {
      const allowedEmployees = user.assignedEmployees || []
      const allowedProjects = user.assignedProjects || []
      if (employeeId) {
        if (allowedEmployees.includes(employeeId) || employeeId === user._id.toString()) {
          query.employeeId = employeeId
        } else {
          return NextResponse.json({ error: 'Forbidden: Cannot access requested employee data' }, { status: 403 })
        }
      } else {
        query.$or = [
          { employeeId: { $in: [...allowedEmployees, user._id.toString()] } },
          { projectId: { $in: allowedProjects } }
        ]
      }
    } else if (employeeId) {
      query.employeeId = employeeId
    }

    if (date) query.date = date
    if (projectId) query.projectId = projectId
    if (flagged === 'true') query.flagged = true

    const entries = await DailyEntry.find(query).sort({ date: -1, createdAt: -1 }).lean()
    return NextResponse.json(entries)
  } catch (error: any) {
    console.error('DailyEntries GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch daily entries' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const user = await getAuthUser(req)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    await connectToDatabase()
    const body = await req.json()
    const entries = Array.isArray(body) ? body : [body]

    if (entries.length === 0) {
      return NextResponse.json({ error: 'At least one task must be submitted' }, { status: 400 })
    }

    const todayDate = getTodayKolkata()
    if (user.role === 'Employee' && entries.some(item =>
      typeof item.taskId !== 'string' ||
      (!/^[a-f\d]{24}$/i.test(item.taskId) && item.taskId !== 'OFFICE_WORK')
    )) {
      return NextResponse.json({ error: 'Select a task assigned to you or add Office Works from the Daily Entry board.' }, { status: 400 })
    }

    const submittedTaskIds = entries
      .map(item => item.taskId)
      .filter((taskId): taskId is string => typeof taskId === 'string' && /^[a-f\d]{24}$/i.test(taskId))
    const uniqueSubmittedTaskIds = Array.from(new Set(submittedTaskIds))

    if (user.role === 'Employee' && uniqueSubmittedTaskIds.length !== submittedTaskIds.length) {
      return NextResponse.json({ error: 'A task can only be added to Daily Entry once per day.' }, { status: 409 })
    }

    // Enforce Project Security Rule for Employees
    if (user.role === 'Employee') {
      const userTasks = await Task.find({ assignedEmployeeIds: user._id.toString() }).select('_id projectId')
      const assignedTaskIds = new Set(userTasks.map(task => task._id.toString()))
      if (uniqueSubmittedTaskIds.some(taskId => !assignedTaskIds.has(taskId))) {
        return NextResponse.json({ error: 'You can only add tasks assigned to you to Daily Entry.' }, { status: 403 })
      }

      const taskProjectIds = userTasks.map(t => t.projectId)
      const directProjectIds = user.assignedProjects || []
      const allowedProjectIds = new Set<string>([
        ...taskProjectIds,
        ...directProjectIds,
        'OFFICE_WORKS',
        'OFFICE_PROJECT',
        'ZP_SCHOOL_PROJ'
      ])

      for (const item of entries) {
        if (item.projectId && !allowedProjectIds.has(item.projectId)) {
          // Verify if project exists and is assigned
          const projExists = await Task.exists({ projectId: item.projectId, assignedEmployeeIds: user._id.toString() })
          if (!projExists) {
            return NextResponse.json({ error: 'Forbidden: You are not authorized for the selected project' }, { status: 403 })
          }
        }
      }
    }

    // Validate entries
    let totalSubmittedHours = 0
    for (const item of entries) {
      const taskTitleStr = (item.taskTitle || item.title || '').trim()
      const detailsStr = (item.details || item.description || '').trim()
      const actionTakenStr = (item.actionTaken || '').trim()

      if (!taskTitleStr) {
        return NextResponse.json({ error: 'Task title is required for all entries' }, { status: 400 })
      }
      if (!detailsStr) {
        return NextResponse.json({ error: 'Description is required for all entries' }, { status: 400 })
      }
      if (!actionTakenStr) {
        return NextResponse.json({ error: 'Action Taken is required for all tasks' }, { status: 400 })
      }
      const parsedHours = parseTimeInput(item.hours ?? item.hoursDisplay)
      if (!parsedHours.ok) {
        return NextResponse.json({ error: parsedHours.error }, { status: 400 })
      }
      item._parsedHours = parsedHours.hours
      if (item.flagged === undefined || item.flagged === null) {
        return NextResponse.json({ error: 'Please select Flag before submitting.' }, { status: 400 })
      }
      const selectedStatus = typeof item.status === 'string' ? item.status.trim() : ''
      if (selectedStatus !== 'In Progress' && selectedStatus !== 'Completed') {
        return NextResponse.json({ error: 'Please select task status before submitting.' }, { status: 400 })
      }
      item._selectedStatus = selectedStatus

      totalSubmittedHours += parsedHours.hours
    }

    const existingTodayEntries = await DailyEntry.find({
      employeeId: user._id.toString(),
      date: todayDate
    }).lean()

    if (user.role === 'Employee') {
      const existingTaskIds = new Set(existingTodayEntries.map(entry => entry.taskId))
      if (uniqueSubmittedTaskIds.some(taskId => existingTaskIds.has(taskId))) {
        return NextResponse.json({ error: 'This task is already in your Daily Entry for today.' }, { status: 409 })
      }

      const officeWorkEntries = entries.filter(item => item.taskId === 'OFFICE_WORK')
      const getOfficeWorkKey = (item: { projectId?: string; taskTitle?: string; title?: string }) =>
        `${item.projectId || 'OFFICE_PROJECT'}|${(item.taskTitle || item.title || '').trim().toLowerCase()}`
      const submittedOfficeWorkKeys = officeWorkEntries.map(getOfficeWorkKey)
      if (new Set(submittedOfficeWorkKeys).size !== submittedOfficeWorkKeys.length) {
        return NextResponse.json({ error: 'A task can only be added to Daily Entry once per day.' }, { status: 409 })
      }

      const existingOfficeWorkKeys = new Set(
        existingTodayEntries
          .filter(entry => entry.taskId === 'OFFICE_WORK')
          .map(getOfficeWorkKey)
      )
      if (submittedOfficeWorkKeys.some(key => existingOfficeWorkKeys.has(key))) {
        return NextResponse.json({ error: 'This task is already in your Daily Entry for today.' }, { status: 409 })
      }
    }

    const existingTotalHours = existingTodayEntries.reduce((sum, e) => sum + (e.hours || 0), 0)
    const grandTotal = Number((existingTotalHours + totalSubmittedHours).toFixed(2))

    const createdEntries = []
    for (const item of entries) {
      const taskTitleStr = (item.taskTitle || item.title || 'Daily Work').trim()
      const detailsStr = (item.details || item.description || '').trim()
      const actionTakenStr = (item.actionTaken || '').trim()

      const entry = await DailyEntry.create({
        employeeId: user._id.toString(),
        employeeName: `${user.firstName} ${user.lastName}`,
        taskId: item.taskId || 'OFFICE_WORK',
        projectId: item.projectId || 'OFFICE_PROJECT',
        projectName: item.projectName || 'Office Works',
        taskTitle: taskTitleStr,
        details: detailsStr,
        actionTaken: actionTakenStr,
        date: todayDate,
        hours: Number(item._parsedHours ?? item.hours),
        flagged: Boolean(item.flagged),
        flagComment: item.flagged ? (item.flagComment ? item.flagComment.trim() : '') : '',
        status: item._selectedStatus
      })

      // Update linked task progress if taskId belongs to a real task
      if (item.taskId && item.taskId !== 'OFFICE_WORK' && item.taskId.length === 24) {
        try {
          const task = await Task.findById(item.taskId)
          if (task) {
            const empName = `${user.firstName} ${user.lastName}`
            const empId = user._id.toString()
            const previousStatus = task.status
            const submittedWorkDone = item.workDone !== undefined ? Number(item.workDone) : (task.workDone || 0)
            task.assigneeProgress = applyEmployeeSubmission(
              ensureAssigneeProgress(
                task.assignedEmployeeIds || [],
                task.assignedEmployeeNames || [],
                task.assigneeProgress || [],
                task.status,
                task.workDone || 0
              ),
              empId,
              empName,
              submittedWorkDone
            )
            const aggregated = aggregateAssigneeProgress(task.assigneeProgress || [], task.status)
            task.workDone = aggregated.workDone
            if (task.status !== 'Completed') {
              task.status = aggregated.status
            }
            if (item.flagged) {
              task.flagStatus = 'Open'
              task.flagMessage = item.flagComment
              task.flagDate = todayDate
            }
            if (aggregated.status === 'Pending Approval' && submittedWorkDone >= 100 && previousStatus !== 'Pending Approval' && previousStatus !== 'Completed') {
              await sendNotifications({
                recipientRoles: ['Director'],
                projectId: task.projectId,
                employeeId: empId,
                type: 'COMPLETION_PENDING',
                title: `Task Completion Approval Required`,
                message: `${empName} submitted completion for '${task.title}' in ${task.projectName}`,
                taskId: task._id.toString(),
                relatedUserId: empId,
                relatedUserName: empName
              })
            }
            await task.save()
          }
        } catch (err) {
          console.error('Error updating task from daily entry:', err)
        }
      }

      if (item.flagged) {
        const concernedPersonId = typeof item.concernedPersonId === 'string' ? item.concernedPersonId.trim() : ''
        if (/^[a-f\d]{24}$/i.test(concernedPersonId)) {
          const concerned = await Employee.findById(concernedPersonId).select('_id firstName lastName role')
          if (concerned) {
            const existingOpen = await Flag.findOne({
              taskId: entry.taskId,
              createdBy: user._id.toString(),
              concernedPersonId: concerned._id.toString(),
              status: 'Open'
            })
            if (!existingOpen) {
              const creatorName = `${user.firstName} ${user.lastName}`
              await Flag.create({
                taskId: entry.taskId,
                taskTitle: taskTitleStr,
                projectId: entry.projectId,
                projectName: entry.projectName,
                employeeId: user._id.toString(),
                employeeName: creatorName,
                createdBy: user._id.toString(),
                createdByName: creatorName,
                createdByRole: user.role,
                concernedPersonId: concerned._id.toString(),
                concernedPersonName: `${concerned.firstName} ${concerned.lastName}`,
                flagType: item.flagType || 'Needs Attention',
                flagMessage: (item.flagComment || '').trim(),
                flagDate: todayDate,
                status: 'Open'
              })
              if (concerned._id.toString() !== user._id.toString()) {
                await sendNotifications({
                  recipientUserId: concerned._id.toString(),
                  type: 'TASK_FLAGGED',
                  title: `${creatorName} assigned a flag`,
                  message: `${creatorName} flagged '${taskTitleStr}': ${(item.flagComment || '').trim()}`,
                  taskId: entry.taskId,
                  projectId: entry.projectId,
                  relatedUserId: user._id.toString(),
                  relatedUserName: creatorName
                })
              }
            }
          }
        }
      }

      if (user.role === 'Employee') {
        const empName = `${user.firstName} ${user.lastName}`
        await sendNotifications({
          recipientRoles: ['Director'],
          projectId: item.projectId,
          employeeId: user._id.toString(),
          type: 'DAILY_WORK_SUBMITTED',
          title: `Daily Work Submitted: ${empName}`,
          message: `${empName} submitted daily work for ${item.projectName || 'Project'}: '${taskTitleStr}' (${item.hours || 1} hrs)`,
          taskId: item.taskId,
          relatedUserId: user._id.toString(),
          relatedUserName: empName
        })
      }

      createdEntries.push(entry)
    }

    return NextResponse.json({
      message: 'Daily entry submitted successfully.',
      count: createdEntries.length,
      totalHoursSubmitted: totalSubmittedHours,
      totalAllocatedToday: grandTotal,
      freeHoursRemaining: Math.max(0, 8 - grandTotal),
      entries: createdEntries
    }, { status: 201 })
  } catch (error: any) {
    console.error('DailyEntries POST error:', error)
    return NextResponse.json({ error: 'Failed to save daily entry' }, { status: 500 })
  }
}
