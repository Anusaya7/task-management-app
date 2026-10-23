import { NextRequest, NextResponse } from 'next/server'
import dbConnect from '../../../../../lib/mongodb'
import Task from '../../../../../models/Task'
import { getAuthUser } from '../../../../../lib/auth'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getAuthUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    await dbConnect()

    const body = await request.json()
    const content = typeof body.content === 'string' ? body.content.trim() : ''
    if (!content) {
      return NextResponse.json({ error: 'Comment is required.' }, { status: 400 })
    }

    const updatedTask = await Task.findById(params.id)

    if (!updatedTask) {
      return NextResponse.json({ message: 'Task not found' }, { status: 404 })
    }
    if (user.role === 'Employee' &&
      !(updatedTask.assignedEmployeeIds || []).includes(user._id.toString())) {
      return NextResponse.json({ error: 'Forbidden: You can only comment on tasks assigned to you.' }, { status: 403 })
    }
    if (user.role === 'Project Head') {
      const allowedProjects = user.assignedProjects || []
      const allowedEmployees = user.assignedEmployees || []
      const canAccessTask = allowedProjects.includes(updatedTask.projectId) ||
        updatedTask.projectHeadId === user._id.toString() ||
        (updatedTask.assignedEmployeeIds || []).includes(user._id.toString()) ||
        (updatedTask.assignedEmployeeIds || []).some(id => allowedEmployees.includes(id))
      if (!canAccessTask) {
        return NextResponse.json({ error: 'Forbidden: Task outside assigned scope.' }, { status: 403 })
      }
    }

    const comment = {
      id: Date.now().toString(),
      taskId: params.id,
      userId: user._id.toString(),
      userName: `${user.firstName} ${user.lastName}`,
      role: user.role,
      content,
      timestamp: new Date().toISOString(),
      isVisibleToEmployee: true
    }
    updatedTask.comments = updatedTask.comments || []
    updatedTask.comments.push(comment)
    await updatedTask.save()

    // Normalize the response
    const taskObj = updatedTask.toObject()
    const normalizedTask = {
      ...taskObj,
      id: taskObj._id,
      comments: Array.isArray((taskObj as any).comments) ? (taskObj as any).comments.map((comment: any) => ({
        ...comment,
        id: comment._id || comment.id
      })) : []
    }

    return NextResponse.json(normalizedTask)
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 400 }
    )
  }
}
