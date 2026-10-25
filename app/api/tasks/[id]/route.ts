import { NextResponse } from 'next/server'
import connectToDatabase from '@/lib/mongodb'
import Task from '@/models/Task'
import Project from '@/models/Project'
import Employee from '@/models/Employee'
import PrivateRating from '@/models/PrivateRating'
import DailyEntry from '@/models/DailyEntry'
import Flag from '@/models/Flag'
import Notification from '@/models/Notification'
import Reminder from '@/models/Reminder'
import TaskHistory from '@/models/TaskHistory'
import TaskAssignmentHistory from '@/models/TaskAssignmentHistory'
import { ensureTaskCodes } from '@/lib/hierarchyCodes'
import { getAuthUser } from '@/lib/auth'
import { ensureAssigneeProgress, serializeTaskWithAssignees } from '@/lib/assigneeProgress'
import { normalizeEmployeeStatus } from '@/lib/employeeStatus'
import { sendNotifications } from '@/lib/notifications'

export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    const user = await getAuthUser(req)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    await connectToDatabase()
    const task = await Task.findById(params.id).lean()
    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 })
    }

    if (user.role === 'Employee') {
      const isAssigned = (task.assignedEmployeeIds || []).includes(user._id.toString())
      if (!isAssigned) {
        return NextResponse.json({ error: 'Forbidden: You can only view tasks assigned to you' }, { status: 403 })
      }
    }

    if (user.role === 'Project Head') {
      const allowedEmps = user.assignedEmployees || []
      const allowedProjs = user.assignedProjects || []
      const isAllowed = (task.assignedEmployeeIds || []).some(id => allowedEmps.includes(id)) ||
                        allowedProjs.includes(task.projectId) ||
                        task.projectHeadId === user._id.toString()
      if (!isAllowed) {
        return NextResponse.json({ error: 'Forbidden: Task outside assigned scope' }, { status: 403 })
      }
    }

    if (user.role === 'Director') {
      const pr = await PrivateRating.findOne({ taskId: params.id })
      return NextResponse.json({
        ...serializeTaskWithAssignees(task),
        rating: pr ? pr.rating : undefined,
        privateComment: pr ? pr.privateComment : undefined
      })
    }

    const { rating, privateComment, ...cleanTask } = serializeTaskWithAssignees(task) as any
    return NextResponse.json(cleanTask)
  } catch (error: any) {
    console.error('Task GET by ID error:', error)
    return NextResponse.json({ error: 'Failed to fetch task' }, { status: 500 })
  }
}

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  try {
    const user = await getAuthUser(req)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (user.role === 'Employee') {
      return NextResponse.json({ error: 'Forbidden: Employees cannot edit assigned tasks' }, { status: 403 })
    }

    await connectToDatabase()
    const task = await Task.findById(params.id)
    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 })
    }

    if (user.role === 'Project Head') {
      const allowedEmps = user.assignedEmployees || []
      const allowedProjs = user.assignedProjects || []
      const isAllowed = (task.assignedEmployeeIds || []).some(id => allowedEmps.includes(id)) ||
                        allowedProjs.includes(task.projectId) ||
                        task.projectHeadId === user._id.toString()
      if (!isAllowed) {
        return NextResponse.json({ error: 'Forbidden: Task outside assigned scope' }, { status: 403 })
      }
    }

    const body = await req.json()
    const nextComment = typeof body.nextComment === 'string' ? body.nextComment.trim() : ''
    if (body.nextComment !== undefined && !nextComment) {
      return NextResponse.json({ error: 'Comment cannot be empty.' }, { status: 400 })
    }

    const previousTitle = task.title
    const previousProjectId = task.projectId
    const previousProjectName = task.projectName
    const previousParentId = String(task.parentTaskId || '')
    const nextStartDate = body.startDate !== undefined ? body.startDate : task.startDate
    const nextDueDate = body.dueDate !== undefined ? body.dueDate : task.dueDate
    const isValidDate = (value: unknown) => {
      if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
      const parsed = new Date(`${value}T00:00:00.000Z`)
      return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
    }
    if (nextStartDate && !isValidDate(nextStartDate)) {
      return NextResponse.json({ error: 'Start date must be a valid calendar date.' }, { status: 400 })
    }
    if (nextDueDate && !isValidDate(nextDueDate)) {
      return NextResponse.json({ error: 'Due date must be a valid calendar date.' }, { status: 400 })
    }
    if (nextStartDate && nextDueDate && nextDueDate < nextStartDate) {
      return NextResponse.json({ error: 'Due date must be on or after the start date.' }, { status: 400 })
    }
    if (body.title) task.title = String(body.title).trim()
    if (body.description !== undefined) task.description = String(body.description).trim() || task.title
    if (body.projectId) {
      const project = await Project.findById(body.projectId)
      if (!project) {
        return NextResponse.json({ error: 'Selected Project does not exist' }, { status: 400 })
      }
      if (user.role === 'Project Head' &&
        !(user.assignedProjects || []).includes(project._id.toString())) {
        return NextResponse.json({ error: 'Project Head can only move tasks to assigned projects.' }, { status: 403 })
      }
      task.projectId = project._id.toString()
      task.projectName = project.projectName
    }
    const isDirectorPersonalTask = user.role === 'Director' &&
      task.assignedById === user._id.toString() &&
      task.assignedEmployeeIds.length === 1 &&
      task.assignedEmployeeIds[0] === user._id.toString()
    if (user.role === 'Director' && !isDirectorPersonalTask) {
      const requestedCoordinatorId = body.projectHeadId ?? task.projectHeadId
      if (
        typeof requestedCoordinatorId !== 'string' ||
        !/^[a-f\d]{24}$/i.test(requestedCoordinatorId)
      ) {
        return NextResponse.json({ error: 'Please select a Project Co-ordinator.' }, { status: 400 })
      }
      const coordinator = await Employee.findOne({
        _id: requestedCoordinatorId,
        role: 'Project Head'
      }).select('_id status assignedProjects')
      if (
        !coordinator ||
        normalizeEmployeeStatus(coordinator.status) !== 'Active'
      ) {
        return NextResponse.json({ error: 'Select an active Project Co-ordinator.' }, { status: 400 })
      }
      task.projectHeadId = coordinator._id.toString()
    }
    if (body.priority) task.priority = body.priority
    if (Array.isArray(body.assignedEmployeeIds) && body.assignedEmployeeIds.length > 0) {
      if (user.role === 'Project Head') {
        const allowed = user.assignedEmployees || []
        const requested = body.assignedEmployeeIds
        const valid = allowed.length > 0
          ? requested.filter((id: string) => allowed.includes(id) || id === user._id.toString())
          : requested
        if (valid.length === 0) {
          return NextResponse.json({ error: 'Project Head can only assign tasks to allowed employees' }, { status: 403 })
        }
        task.assignedEmployeeIds = valid
      } else {
        task.assignedEmployeeIds = body.assignedEmployeeIds
      }
      const assignees = await Employee.find({ _id: { $in: task.assignedEmployeeIds } })
      if (user.role === 'Director') {
        const validAssignees = assignees.filter(employee =>
          ['Employee', 'Project Head'].includes(employee.role) &&
          normalizeEmployeeStatus(employee.status) === 'Active' &&
          (employee.role !== 'Project Head' ||
            (employee.assignedProjects || []).includes(task.projectId))
        )
        if (validAssignees.length !== task.assignedEmployeeIds.length || validAssignees.length === 0) {
          return NextResponse.json({ error: 'Assign active employees or Project Heads authorized for this project.' }, { status: 400 })
        }
        task.assignedEmployeeIds = validAssignees.map(employee => employee._id.toString())
        task.assignedEmployeeNames = validAssignees.map(employee => `${employee.firstName} ${employee.lastName}`)
      } else {
        task.assignedEmployeeNames = assignees.map(e => `${e.firstName} ${e.lastName}`)
      }
      task.assigneeProgress = ensureAssigneeProgress(
        task.assignedEmployeeIds,
        task.assignedEmployeeNames,
        task.assigneeProgress || []
      )
    }
    if (body.reminderDate !== undefined) task.reminderDate = body.reminderDate || undefined
    if (body.startDate !== undefined) task.startDate = body.startDate || undefined
    if (body.dueDate !== undefined) task.dueDate = body.dueDate || undefined
    if (body.estimatedHours !== undefined) {
      const hours = Number(body.estimatedHours)
      task.estimatedHours = Number.isFinite(hours) && hours >= 0 ? hours : undefined
    }
    if (nextComment) {
      task.comments = task.comments || []
      task.comments.push({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        taskId: task._id.toString(),
        userId: user._id.toString(),
        userName: `${user.firstName} ${user.lastName}`,
        role: user.role,
        content: nextComment,
        timestamp: new Date().toISOString(),
        isVisibleToEmployee: true
      })
    }
    if (body.parentTaskId !== undefined) {
      const nextParentId = body.parentTaskId ? String(body.parentTaskId) : ''
      if (!nextParentId) {
        task.parentTaskId = undefined
        task.parentTaskTitle = undefined
      } else if (nextParentId === task._id.toString()) {
        return NextResponse.json({ error: 'A task cannot be its own parent' }, { status: 400 })
      } else {
        const parentTask = await Task.findById(nextParentId)
        if (!parentTask || parentTask.projectId !== task.projectId) {
          return NextResponse.json({ error: 'Parent task must belong to the same project' }, { status: 400 })
        }
        if (parentTask.parentTaskId) {
          return NextResponse.json({ error: 'Subtasks can only be added under a main task, not another subtask' }, { status: 400 })
        }
        task.parentTaskId = parentTask._id.toString()
        task.parentTaskTitle = parentTask.title
      }
    }
    const projectMoved = task.projectId !== previousProjectId
    const parentMoved = String(task.parentTaskId || '') !== previousParentId
    if (projectMoved || parentMoved) task.taskCode = undefined
    task.updatedAt = new Date()
    await task.save()
    if (user.role === 'Director' && task.projectHeadId) {
      await Employee.updateOne(
        { _id: task.projectHeadId },
        { $addToSet: { assignedProjects: task.projectId } }
      )
    }

    if (user.role === 'Director' || user.role === 'Project Head') {
      const openFlags = await Flag.find({ taskId: task._id.toString(), status: 'Open' })
      const visibleOpenFlags = user.role === 'Project Head'
        ? openFlags.filter(flag =>
            (user.assignedEmployees || []).includes(flag.employeeId) || flag.employeeId === user._id.toString()
          )
        : openFlags
      const resolvedBy = `${user.firstName} ${user.lastName}`.trim()
      for (const flag of visibleOpenFlags) {
        flag.status = 'Resolved'
        flag.managementResponse = nextComment || 'Task reviewed and submitted by management.'
        flag.resolvedBy = resolvedBy
        flag.resolvedAt = new Date()
        await flag.save()
      }
      if (visibleOpenFlags.length > 0) {
        const remainingOpenFlag = await Flag.exists({ taskId: task._id.toString(), status: 'Open' })
        if (!remainingOpenFlag) {
          task.flagStatus = 'Resolved'
          await task.save()
        }
        await Promise.all(visibleOpenFlags.map(flag => sendNotifications({
          recipientUserId: flag.employeeId,
          type: 'TASK_FLAGGED',
          title: 'Task Flag Resolved',
          message: `${user.role} (${resolvedBy}) resolved the flag on '${flag.taskTitle || task.title}'`,
          taskId: task._id.toString(),
          relatedUserId: user._id.toString(),
          relatedUserName: resolvedBy
        })))
      }
    }

    if (projectMoved || parentMoved) {
      if (projectMoved) {
        await Task.updateMany(
          { parentTaskId: task._id.toString() },
          { $set: { projectId: task.projectId, projectName: task.projectName }, $unset: { taskCode: '' } }
        )
      } else {
        await Task.updateMany({ parentTaskId: task._id.toString() }, { $unset: { taskCode: '' } })
      }
      await ensureTaskCodes(Array.from(new Set([previousProjectId, task.projectId].filter(Boolean))))
    }

    // Subtasks, daily entries, flags and reminders store a copy of the task/project name.
    const taskId = task._id.toString()
    const titleChanged = task.title !== previousTitle
    const projectChanged = task.projectId !== previousProjectId || task.projectName !== previousProjectName
    if (titleChanged || projectChanged) {
      const copiedFields: Record<string, string | undefined> = {}
      if (titleChanged) copiedFields.taskTitle = task.title
      if (projectChanged) {
        copiedFields.projectId = task.projectId
        copiedFields.projectName = task.projectName
      }
      await Promise.all([
        DailyEntry.updateMany({ taskId }, { $set: copiedFields }),
        Flag.updateMany({ taskId }, { $set: copiedFields }),
        ...(titleChanged
          ? [
              Reminder.updateMany({ taskId }, { $set: { taskTitle: task.title } }),
              Task.updateMany({ parentTaskId: taskId }, { $set: { parentTaskTitle: task.title } })
            ]
          : [])
      ])
    }

    const savedTask = (await Task.findById(task._id)) || task
    return NextResponse.json(serializeTaskWithAssignees(savedTask))
  } catch (error: any) {
    console.error('Task PUT API error:', error)
    return NextResponse.json({ error: 'Failed to update task' }, { status: 500 })
  }
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  try {
    const user = await getAuthUser(req)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (user.role !== 'Director') {
      return NextResponse.json({ error: 'Forbidden: Only Director can delete tasks' }, { status: 403 })
    }

    await connectToDatabase()
    const task = await Task.findById(params.id).select('_id')
    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 })
    }

    const taskId = task._id.toString()
    const subtasks = await Task.find({ parentTaskId: taskId }).select('_id')
    const taskIds = [taskId, ...subtasks.map(subtask => subtask._id.toString())]
    await Promise.all([
      Task.deleteMany({ _id: { $in: taskIds } }),
      DailyEntry.deleteMany({ taskId: { $in: taskIds } }),
      Flag.deleteMany({ taskId: { $in: taskIds } }),
      Notification.deleteMany({ taskId: { $in: taskIds } }),
      Reminder.deleteMany({ taskId: { $in: taskIds } }),
      TaskHistory.deleteMany({ taskId: { $in: taskIds } }),
      TaskAssignmentHistory.deleteMany({ taskId: { $in: taskIds } }),
      PrivateRating.deleteMany({ taskId: { $in: taskIds } })
    ])
    return NextResponse.json({ success: true, message: 'Task deleted successfully' })
  } catch (error: any) {
    console.error('Task DELETE API error:', error)
    return NextResponse.json({ error: 'Failed to delete task' }, { status: 500 })
  }
}
