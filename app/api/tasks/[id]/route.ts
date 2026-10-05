import { NextResponse } from 'next/server'
import connectToDatabase from '@/lib/mongodb'
import Task from '@/models/Task'
import Project from '@/models/Project'
import Employee from '@/models/Employee'
import PrivateRating from '@/models/PrivateRating'
import { getAuthUser } from '@/lib/auth'
import { ensureAssigneeProgress, serializeTaskWithAssignees } from '@/lib/assigneeProgress'

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
    if (body.title) task.title = String(body.title).trim()
    if (body.description !== undefined) task.description = String(body.description).trim() || task.title
    if (body.projectId) {
      const project = await Project.findById(body.projectId)
      if (!project) {
        return NextResponse.json({ error: 'Selected Project does not exist' }, { status: 400 })
      }
      task.projectId = project._id.toString()
      task.projectName = project.projectName
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
        const employeeAssignees = assignees.filter(e => e.role === 'Employee')
        if (employeeAssignees.length === 0) {
          return NextResponse.json({ error: 'Please assign at least one employee.' }, { status: 400 })
        }
        task.assignedEmployeeIds = employeeAssignees.map(e => e._id.toString())
        task.assignedEmployeeNames = employeeAssignees.map(e => `${e.firstName} ${e.lastName}`)
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
    task.updatedAt = new Date()
    await task.save()

    return NextResponse.json(serializeTaskWithAssignees(task))
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
    await Task.findByIdAndDelete(params.id)
    return NextResponse.json({ success: true, message: 'Task deleted successfully' })
  } catch (error: any) {
    console.error('Task DELETE API error:', error)
    return NextResponse.json({ error: 'Failed to delete task' }, { status: 500 })
  }
}
