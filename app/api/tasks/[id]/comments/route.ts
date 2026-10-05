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

    const { content } = await request.json()

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

    const updatedTask = await Task.findByIdAndUpdate(
      params.id,
      { $push: { comments: comment } },
      { new: true }
    )

    if (!updatedTask) {
      return NextResponse.json({ message: 'Task not found' }, { status: 404 })
    }

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
