import { NextResponse } from 'next/server'
import connectToDatabase from '@/lib/mongodb'
import Task from '@/models/Task'
import PrivateRating from '@/models/PrivateRating'
import { getAuthUser } from '@/lib/auth'

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
        ...task,
        rating: pr ? pr.rating : undefined,
        privateComment: pr ? pr.privateComment : undefined
      })
    }

    const { rating, privateComment, ...cleanTask } = task as any
    return NextResponse.json(cleanTask)
  } catch (error: any) {
    console.error('Task GET by ID error:', error)
    return NextResponse.json({ error: 'Failed to fetch task' }, { status: 500 })
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
