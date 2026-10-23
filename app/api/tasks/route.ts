import { NextResponse } from 'next/server'
import mongoose from 'mongoose'
import connectToDatabase from '@/lib/mongodb'
import Task from '@/models/Task'
import Project from '@/models/Project'
import Employee from '@/models/Employee'
import PrivateRating from '@/models/PrivateRating'
import { getAuthUser, getTodayKolkata } from '@/lib/auth'
import { normalizeEmployeeStatus } from '@/lib/employeeStatus'
import { sendNotifications } from '@/lib/notifications'
import { ensureAssigneeProgress, serializeTaskWithAssignees } from '@/lib/assigneeProgress'
import { ensureTaskCodes } from '@/lib/hierarchyCodes'

export const dynamic = 'force-dynamic'

const isValidCalendarDate = (value: unknown): value is string => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const parsed = new Date(`${value}T00:00:00.000Z`)
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
}

export async function GET(req: Request) {
  try {
    const user = await getAuthUser(req)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    await connectToDatabase()
    const { searchParams } = new URL(req.url)
    const priority = searchParams.get('priority')
    const status = searchParams.get('status')
    const projectId = searchParams.get('projectId')
    const employeeId = searchParams.get('employeeId')
    const employeeOpeningView = searchParams.get('view') === 'employee-opening'

    let query: any = {}

    if (user.role === 'Director') {
      if (employeeId) {
        query.assignedEmployeeIds = employeeId
      }
    } else if (user.role === 'Project Head') {
      const allowedEmployees = user.assignedEmployees || []
      const allowedProjects = user.assignedProjects || []
      query.$or = [
        { assignedEmployeeIds: { $in: allowedEmployees } },
        { projectId: { $in: allowedProjects } },
        { projectHeadId: user._id.toString() }
      ]
    } else {
      // Employee role: strictly own tasks
      query.assignedEmployeeIds = user._id.toString()
      if (employeeOpeningView) {
        const managerIds = (await Employee.find({ role: { $in: ['Director', 'Project Head'] } }).select('_id').lean())
          .map(employee => employee._id.toString())
        query.$or = [
          { assignedById: user._id.toString() },
          {
            assignedById: { $in: managerIds },
            priority: { $in: ['Urgent', 'Medium', 'Low', 'Daily'] }
          }
        ]
      }
    }

    if (priority) query.priority = priority
    if (status) query.status = status
    if (projectId) query.projectId = projectId

    await ensureTaskCodes()
    let tasks = await Task.find(query).sort({ updatedAt: -1 }).lean()
    tasks = tasks.map(serializeTaskWithAssignees)

    // If Director, attach Private Ratings
    if (user.role === 'Director') {
      const taskIds = tasks.map(t => t._id.toString())
      const ratings = await PrivateRating.find({ taskId: { $in: taskIds } })
      const ratingMap = new Map(ratings.map(r => [r.taskId, r]))

      tasks = tasks.map(t => {
        const pr = ratingMap.get(t._id.toString())
        return {
          ...t,
          rating: pr ? pr.rating : undefined,
          privateComment: pr ? pr.privateComment : undefined
        }
      })
    } else {
      // Ensure rating is completely stripped for Non-Directors
      tasks = tasks.map(t => {
        const { rating, privateComment, ...rest } = t as any
        return rest
      })
    }

    return NextResponse.json(tasks)
  } catch (error: any) {
    console.error('Tasks GET API error:', error)
    return NextResponse.json({ error: 'Failed to fetch tasks' }, { status: 500 })
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
    const {
      title,
      description,
      projectId,
      projectHeadId,
      priority,
      assignedEmployeeIds,
      reminderDate,
      parentTaskId,
      startDate,
      dueDate,
      estimatedHours,
      personalTask,
      subtasks
    } = body
    const trimmedTitle = typeof title === 'string' ? title.trim() : ''
    const isManagementPersonalTask =
      (user.role === 'Director' || user.role === 'Project Head') && personalTask === true

    if (!trimmedTitle || !projectId) {
      return NextResponse.json({ error: 'Task Title and Project selection are required' }, { status: 400 })
    }
    if (typeof description !== 'string' || !description.trim()) {
      return NextResponse.json({ error: 'Description / first comment is required.' }, { status: 400 })
    }
    if (personalTask === true && !isManagementPersonalTask) {
      return NextResponse.json({ error: 'Only a Director or Project Head can create a personal task.' }, { status: 403 })
    }
    if (!isValidCalendarDate(startDate) || !isValidCalendarDate(dueDate)) {
      return NextResponse.json({ error: 'Valid start and due dates are required.' }, { status: 400 })
    }
    if (dueDate < startDate) {
      return NextResponse.json({ error: 'Due date must be on or after the start date.' }, { status: 400 })
    }
    if (subtasks !== undefined && (!Array.isArray(subtasks) || subtasks.length > 50 ||
      subtasks.some((item: unknown) => typeof item !== 'string' || !item.trim()))) {
      return NextResponse.json({ error: 'Subtasks must be non-empty task names.' }, { status: 400 })
    }
    if (!mongoose.Types.ObjectId.isValid(String(projectId))) {
      return NextResponse.json({ error: 'Selected Project does not exist' }, { status: 400 })
    }

    const project = await Project.findById(projectId)
    if (!project) {
      return NextResponse.json({ error: 'Selected Project does not exist' }, { status: 400 })
    }
    let projectCoordinatorId: string | undefined
    if (user.role === 'Director' && !isManagementPersonalTask) {
      if (typeof projectHeadId !== 'string' || !mongoose.Types.ObjectId.isValid(projectHeadId)) {
        return NextResponse.json({ error: 'Please select a Project Co-ordinator.' }, { status: 400 })
      }
      const coordinator = await Employee.findOne({
        _id: projectHeadId,
        role: 'Project Head'
      }).select('_id status assignedProjects')
      if (
        !coordinator ||
        normalizeEmployeeStatus(coordinator.status) !== 'Active' ||
        !(coordinator.assignedProjects || []).includes(project._id.toString())
      ) {
        return NextResponse.json({ error: 'Select an active Project Co-ordinator assigned to this project.' }, { status: 400 })
      }
      projectCoordinatorId = coordinator._id.toString()
    } else if (user.role === 'Project Head') {
      projectCoordinatorId = user._id.toString()
    }
    if (
      user.role === 'Project Head' &&
      !(user.assignedProjects || []).includes(project._id.toString())
    ) {
      return NextResponse.json({ error: 'Project Head can only create tasks for assigned projects.' }, { status: 403 })
    }

    let resolvedParentId = ''
    let resolvedParentTitle = ''
    if (parentTaskId) {
      if (!mongoose.Types.ObjectId.isValid(String(parentTaskId))) {
        return NextResponse.json({ error: 'Selected parent task does not exist' }, { status: 400 })
      }
      let parentTask = await Task.findById(parentTaskId)
      if (!parentTask || parentTask.projectId !== project._id.toString()) {
        return NextResponse.json({ error: 'Parent task must belong to the same project' }, { status: 400 })
      }
      if (parentTask.parentTaskId && String(parentTask.parentTaskId) === parentTask._id.toString()) {
        parentTask.parentTaskId = undefined
        parentTask.parentTaskTitle = undefined
        await parentTask.save()
      }
      // Hierarchy is one level deep: attach to the top-level main task instead of a subtask.
      if (parentTask.parentTaskId && mongoose.Types.ObjectId.isValid(String(parentTask.parentTaskId))) {
        const mainTask = await Task.findById(parentTask.parentTaskId)
        if (mainTask && mainTask.projectId === project._id.toString() && !mainTask.parentTaskId) {
          parentTask = mainTask
        }
      }
      if (!parentTask.parentTaskId) {
        resolvedParentId = parentTask._id.toString()
        resolvedParentTitle = parentTask.title
      }
    }

    let validAssignees: string[] = []
    const allowedPriorities = ['Urgent', 'Medium', 'Low', 'Daily']
    const personalTaskPriorities = [...allowedPriorities, 'Self']
    if (
      (user.role === 'Employee' || isManagementPersonalTask) &&
      (typeof priority !== 'string' || !personalTaskPriorities.includes(priority))
    ) {
      return NextResponse.json({ error: 'Please select a valid priority.' }, { status: 400 })
    }
    if (user.role !== 'Employee' && !isManagementPersonalTask &&
      (typeof priority !== 'string' || !allowedPriorities.includes(priority))) {
      return NextResponse.json({ error: 'Please select a valid priority.' }, { status: 400 })
    }

    if (isManagementPersonalTask) {
      validAssignees = [user._id.toString()]
    } else if (user.role === 'Director') {
      const requested = Array.from(new Set((Array.isArray(assignedEmployeeIds) ? assignedEmployeeIds : []).filter((id: unknown) => typeof id === 'string' && mongoose.Types.ObjectId.isValid(id))))
      const employeeDocs = await Employee.find({
        _id: { $in: requested },
        role: { $in: ['Employee', 'Project Head'] }
      }).select('_id firstName lastName role status assignedProjects')
      const activeAssignees = employeeDocs.filter(emp => {
        if (normalizeEmployeeStatus(emp.status) !== 'Active') return false
        return emp.role !== 'Project Head' ||
          (emp.assignedProjects || []).includes(project._id.toString())
      })
      validAssignees = activeAssignees.map(emp => emp._id.toString())
      if (validAssignees.length !== requested.length || validAssignees.length === 0) {
        return NextResponse.json({ error: 'Assign at least one active employee or Project Head authorized for this project.' }, { status: 400 })
      }
    } else if (user.role === 'Project Head') {
      const allowed = user.assignedEmployees || []
      const requested = Array.from(new Set(
        (Array.isArray(assignedEmployeeIds) ? assignedEmployeeIds : [])
          .filter((id: unknown): id is string => typeof id === 'string' && mongoose.Types.ObjectId.isValid(id))
      ))
      if (allowed.length === 0 || requested.some(id => !allowed.includes(id))) {
        return NextResponse.json({ error: 'Project Head can only assign tasks to assigned employees.' }, { status: 403 })
      }
      const employeeDocs = await Employee.find({
        _id: { $in: requested },
        role: 'Employee'
      }).select('_id firstName lastName')
      validAssignees = employeeDocs
        .filter(emp => normalizeEmployeeStatus(emp.status) === 'Active')
        .map(emp => emp._id.toString())
      if (validAssignees.length !== requested.length) {
        return NextResponse.json({ error: 'Project Head can only assign tasks to active employees in their scope.' }, { status: 400 })
      }
      if (validAssignees.length === 0) {
        return NextResponse.json({ error: 'Please assign at least one employee.' }, { status: 400 })
      }
    } else {
      validAssignees = [user._id.toString()]
    }

    // Fetch assignee names
    const assignees = await Employee.find({ _id: { $in: validAssignees } })
    const assigneeNames = assignees.map(e => `${e.firstName} ${e.lastName}`)

    const taskPriority = priority || 'Medium'

    if (user.role !== 'Employee' && !isManagementPersonalTask) {
      const sameProjectTasks = await Task.find({ projectId: project._id.toString() })
      // Same title only merges within the same parent, so P1/T1 and P1/T2 can both have a "Plans" subtask.
      const sameTitle = sameProjectTasks.filter(item =>
        item.priority !== 'Self' &&
        (item.title || '').trim().toLowerCase() === trimmedTitle.toLowerCase()
      )
      const parentOf = (item: any) => {
        const parentId = String(item.parentTaskId || '')
        return parentId === item._id.toString() ? '' : parentId
      }
      const existing =
        sameTitle.find(item => parentOf(item) === resolvedParentId) ||
        (resolvedParentId ? sameTitle.find(item => !parentOf(item)) : undefined)
      if (existing) {
        const mergedIds = Array.from(new Set([...(existing.assignedEmployeeIds || []), ...validAssignees]))
        const mergedAssignees = await Employee.find({ _id: { $in: mergedIds } })
        const mergedNames = mergedAssignees.map(e => `${e.firstName} ${e.lastName}`)
        const previousIds = new Set(existing.assignedEmployeeIds || [])
        const newlyAssigned = validAssignees.filter(id => !previousIds.has(id))

        existing.assignedEmployeeIds = mergedIds
        existing.assignedEmployeeNames = mergedNames
        if (projectCoordinatorId) existing.projectHeadId = projectCoordinatorId
        existing.assigneeProgress = ensureAssigneeProgress(mergedIds, mergedNames, existing.assigneeProgress || [])
        const nextDescription = description ? String(description).trim() : ''
        if (nextDescription && nextDescription.toLowerCase() !== trimmedTitle.toLowerCase()) {
          existing.description = nextDescription
        }
        if (reminderDate) existing.reminderDate = reminderDate
        if (dueDate) existing.dueDate = dueDate
        if (typeof estimatedHours === 'number' && estimatedHours >= 0) existing.estimatedHours = estimatedHours
        if (existing.parentTaskId && String(existing.parentTaskId) === existing._id.toString()) {
          existing.parentTaskId = undefined
          existing.parentTaskTitle = undefined
        }
        if (resolvedParentId && resolvedParentId !== existing._id.toString() && parentOf(existing) !== resolvedParentId) {
          const existingHasSubtasks = await Task.exists({ parentTaskId: existing._id.toString(), _id: { $ne: existing._id } })
          if (!existingHasSubtasks) {
            existing.parentTaskId = resolvedParentId
            existing.parentTaskTitle = resolvedParentTitle
            existing.taskCode = undefined
          }
        }
        if (priority && existing.priority !== 'Self') existing.priority = taskPriority
        existing.updatedAt = new Date()
        await existing.save()

        const assignerName = `${user.firstName} ${user.lastName}`
        for (const empId of newlyAssigned) {
          const assignee = mergedAssignees.find(emp => emp._id.toString() === empId)
          if (assignee?.role === 'Employee' && empId !== user._id.toString()) {
            await sendNotifications({
              recipientUserId: empId,
              type: 'TASK_ASSIGNED',
              title: `New ${taskPriority} Task Assigned`,
              message: `${assignerName} assigned '${existing.title}' in ${project.projectName}`,
              taskId: existing._id.toString(),
              projectId: project._id.toString(),
              relatedUserId: user._id.toString(),
              relatedUserName: assignerName
            })
          }
          if (assignee?.role === 'Project Head') {
            await sendNotifications({
              recipientUserId: empId,
              type: 'TASK_ASSIGNED',
              title: `New ${taskPriority} Task Assigned`,
              message: `${assignerName} assigned '${existing.title}' in ${project.projectName}`,
              taskId: existing._id.toString(),
              projectId: project._id.toString(),
              relatedUserId: user._id.toString(),
              relatedUserName: assignerName
            })
          }
        }

        await ensureTaskCodes([project._id.toString()])
        const mergedTask = (await Task.findById(existing._id)) || existing
        return NextResponse.json(serializeTaskWithAssignees(mergedTask), { status: 200 })
      }
    }

    const newTask = await Task.create({
      title: trimmedTitle,
      description: description && String(description).trim() ? String(description).trim() : trimmedTitle,
      projectId: project._id.toString(),
      projectName: project.projectName,
      priority: taskPriority,
      status: 'Pending',
      assignedById: user._id.toString(),
      assignedByName: `${user.firstName} ${user.lastName}`,
      assignedEmployeeIds: validAssignees,
      assignedEmployeeNames: assigneeNames,
      workDone: 0,
      reminderDate: reminderDate || undefined,
      startDate: startDate || undefined,
      dueDate: dueDate || reminderDate || undefined,
      parentTaskId: resolvedParentId || undefined,
      parentTaskTitle: resolvedParentTitle || undefined,
      estimatedHours: typeof estimatedHours === 'number' && estimatedHours >= 0 ? estimatedHours : undefined,
      assigneeProgress: ensureAssigneeProgress(validAssignees, assigneeNames),
      projectHeadId: projectCoordinatorId,
    })

    if (description && String(description).trim()) {
      newTask.comments = [{
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        taskId: newTask._id.toString(),
        userId: user._id.toString(),
        userName: `${user.firstName} ${user.lastName}`.trim(),
        role: user.role,
        content: String(description).trim(),
        timestamp: new Date().toISOString(),
        isVisibleToEmployee: true
      }]
      await newTask.save()
    }

    if (Array.isArray(subtasks) && subtasks.length > 0) {
      await Task.insertMany(subtasks.map((subtaskTitle: string) => {
        const subtaskId = new mongoose.Types.ObjectId()
        const subtaskName = subtaskTitle.trim()
        return {
          _id: subtaskId,
          title: subtaskName,
          description: subtaskName,
          projectId: project._id.toString(),
          projectName: project.projectName,
          priority: taskPriority,
          status: 'Pending',
          assignedById: user._id.toString(),
          assignedByName: `${user.firstName} ${user.lastName}`.trim(),
          assignedEmployeeIds: validAssignees,
          assignedEmployeeNames: assigneeNames,
          workDone: 0,
          reminderDate: reminderDate || undefined,
          startDate,
          dueDate,
          parentTaskId: newTask._id.toString(),
          parentTaskTitle: newTask.title,
          assigneeProgress: ensureAssigneeProgress(validAssignees, assigneeNames),
          comments: [{
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            taskId: subtaskId.toString(),
            userId: user._id.toString(),
            userName: `${user.firstName} ${user.lastName}`.trim(),
            role: user.role,
            content: subtaskName,
            timestamp: new Date().toISOString(),
            isVisibleToEmployee: true
          }]
        }
      }))
    }

    // Send Notifications
    const assignerName = `${user.firstName} ${user.lastName}`
    const assigneesText = assigneeNames.join(', ')

    // 1. Notify assigned employees
    for (const empId of validAssignees) {
      const assignee = assignees.find(employee => employee._id.toString() === empId)
      if (assignee?.role === 'Employee' && empId !== user._id.toString()) {
        await sendNotifications({
          recipientUserId: empId,
          type: 'TASK_ASSIGNED',
          title: `New ${taskPriority} Task Assigned`,
          message: `${assignerName} assigned '${newTask.title}' in ${project.projectName}`,
          taskId: newTask._id.toString(),
          projectId: project._id.toString(),
          relatedUserId: user._id.toString(),
          relatedUserName: assignerName
        })
      }
    }

    // 2. Notify Project Head if assigned by Director
    if (user.role === 'Director' && !isManagementPersonalTask) {
      await sendNotifications({
        recipientRoles: ['Project Head'],
        projectId: project._id.toString(),
        type: 'TASK_ASSIGNED',
        title: `New task assigned to ${assigneesText}`,
        message: `Director assigned '${newTask.title}' in ${project.projectName} to ${assigneesText}`,
        taskId: newTask._id.toString(),
        relatedUserId: user._id.toString(),
        relatedUserName: assignerName
      })
    }

    await ensureTaskCodes([project._id.toString()])
    const createdTask = (await Task.findById(newTask._id)) || newTask
    return NextResponse.json(serializeTaskWithAssignees(createdTask), { status: 201 })
  } catch (error: any) {
    console.error('Tasks POST API error:', error)
    return NextResponse.json({ error: 'Failed to create task' }, { status: 500 })
  }
}
