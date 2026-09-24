import { NextResponse } from 'next/server'
import connectToDatabase from '@/lib/mongodb'
import DailyEntry from '@/models/DailyEntry'
import Task from '@/models/Task'
import { getAuthUser, getTodayKolkata } from '@/lib/auth'
import { sendNotifications } from '@/lib/notifications'

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

    // Enforce Project Security Rule for Employees
    if (user.role === 'Employee') {
      const userTasks = await Task.find({ assignedEmployeeIds: user._id.toString() }).select('projectId')
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
      const hrs = Number(item.hours) || 1
      if (isNaN(hrs) || hrs <= 0) {
        return NextResponse.json({ error: 'Please enter valid Hours spent (> 0)' }, { status: 400 })
      }
      if (item.flagged && (!item.flagComment || !item.flagComment.trim())) {
        return NextResponse.json({ error: 'Please add a comment for the flagged task' }, { status: 400 })
      }
      totalSubmittedHours += hrs
    }

    // Check total working hours <= 8 for today
    const existingTodayEntries = await DailyEntry.find({
      employeeId: user._id.toString(),
      date: todayDate
    }).lean()

    const existingTotalHours = existingTodayEntries.reduce((sum, e) => sum + (e.hours || 0), 0)
    const grandTotal = existingTotalHours + totalSubmittedHours

    if (grandTotal > 8.01) {
      return NextResponse.json({
        error: `Total hours cannot exceed 8 hours. Currently allocated: ${existingTotalHours} hrs, attempting to add: ${totalSubmittedHours} hrs.`
      }, { status: 400 })
    }

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
        hours: Number(item.hours) || 1,
        flagged: Boolean(item.flagged),
        flagComment: item.flagged ? (item.flagComment ? item.flagComment.trim() : '') : '',
        status: item.status || 'Completed'
      })

      // Update linked task progress if taskId belongs to a real task
      if (item.taskId && item.taskId !== 'OFFICE_WORK' && item.taskId.length === 24) {
        try {
          const task = await Task.findById(item.taskId)
          if (task) {
            if (item.workDone !== undefined) {
              task.workDone = Number(item.workDone)
            }
            if (item.flagged) {
              task.flagStatus = 'Open'
              task.flagMessage = item.flagComment
              task.flagDate = todayDate
            }
            if (task.workDone === 100) {
              task.status = 'Pending Approval'
              await sendNotifications({
                recipientRoles: ['Director'],
                projectId: task.projectId,
                employeeId: user._id.toString(),
                type: 'COMPLETION_PENDING',
                title: `100% Task Completion Approval Required`,
                message: `${user.firstName} ${user.lastName} submitted 100% completion for '${task.title}' in ${task.projectName}`,
                taskId: task._id.toString(),
                relatedUserId: user._id.toString(),
                relatedUserName: `${user.firstName} ${user.lastName}`
              })
            } else {
              task.status = 'In Progress'
            }
            await task.save()
          }
        } catch (err) {
          console.error('Error updating task from daily entry:', err)
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
