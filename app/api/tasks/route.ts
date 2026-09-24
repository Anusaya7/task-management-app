import { NextResponse } from 'next/server'
import connectToDatabase from '@/lib/mongodb'
import Task from '@/models/Task'
import Project from '@/models/Project'
import Employee from '@/models/Employee'
import PrivateRating from '@/models/PrivateRating'
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
    const priority = searchParams.get('priority')
    const status = searchParams.get('status')
    const projectId = searchParams.get('projectId')
    const employeeId = searchParams.get('employeeId')

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
    }

    if (priority) query.priority = priority
    if (status) query.status = status
    if (projectId) query.projectId = projectId

    let tasks = await Task.find(query).sort({ updatedAt: -1 }).lean()

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
    const { title, description, projectId, priority, assignedEmployeeIds, reminderDate } = body

    if (!title || !projectId) {
      return NextResponse.json({ error: 'Task Title and Project selection are required' }, { status: 400 })
    }

    const project = await Project.findById(projectId)
    if (!project) {
      return NextResponse.json({ error: 'Selected Project does not exist' }, { status: 400 })
    }

    let validAssignees: string[] = []

    if (user.role === 'Director') {
      validAssignees = Array.isArray(assignedEmployeeIds) && assignedEmployeeIds.length > 0
        ? assignedEmployeeIds
        : [user._id.toString()]
    } else if (user.role === 'Project Head') {
      const allowed = user.assignedEmployees || []
      const requested = Array.isArray(assignedEmployeeIds) ? assignedEmployeeIds : []
      // Verify requested assignees are within PH scope
      validAssignees = requested.filter(id => allowed.includes(id) || id === user._id.toString())
      if (validAssignees.length === 0) {
        return NextResponse.json({ error: 'Project Head can only assign tasks to allowed employees' }, { status: 403 })
      }
    } else {
      // Employee role: Self task only
      if (priority !== 'Self') {
        return NextResponse.json({ error: 'Employees can only create Self-assigned tasks' }, { status: 403 })
      }
      validAssignees = [user._id.toString()]
    }

    // Fetch assignee names
    const assignees = await Employee.find({ _id: { $in: validAssignees } })
    const assigneeNames = assignees.map(e => `${e.firstName} ${e.lastName}`)

    const taskPriority = user.role === 'Employee' ? 'Self' : (priority || 'Medium')

    const newTask = await Task.create({
      title: title.trim(),
      description: description ? description.trim() : title.trim(),
      projectId: project._id.toString(),
      projectName: project.projectName,
      priority: taskPriority,
      status: 'Pending',
      assignedById: user._id.toString(),
      assignedByName: `${user.firstName} ${user.lastName}`,
      assignedEmployeeIds: validAssignees,
      assignedEmployeeNames: assigneeNames,
      projectHeadId: user.role === 'Project Head' ? user._id.toString() : undefined,
      workDone: 0,
      reminderDate: reminderDate || undefined
    })

    // Send Notifications
    const assignerName = `${user.firstName} ${user.lastName}`
    const assigneesText = assigneeNames.join(', ')

    // 1. Notify assigned employees
    for (const empId of validAssignees) {
      if (empId !== user._id.toString()) {
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
    if (user.role === 'Director') {
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

    return NextResponse.json(newTask, { status: 201 })
  } catch (error: any) {
    console.error('Tasks POST API error:', error)
    return NextResponse.json({ error: 'Failed to create task' }, { status: 500 })
  }
}
