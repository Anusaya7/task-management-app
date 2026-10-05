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

    const task = await Task.findById(params.id)
    if (!task) {
      return NextResponse.json({ message: 'Task not found' }, { status: 404 })
    }

    if (user.role === 'Employee') {
      const assigned = (task.assignedEmployeeIds || []).includes(user._id.toString())
      if (!assigned) {
        return NextResponse.json({ error: 'Forbidden: You can only request completion for your own tasks' }, { status: 403 })
      }
    }

    const updated = await Task.findByIdAndUpdate(
      params.id,
      {
        completionRequestStatus: 'Pending',
        completionRequestDate: new Date(),
        completionRequestedBy: user._id.toString()
      },
      { new: true, runValidators: false }
    )

    if (!updated) {
      return NextResponse.json({ message: 'Task not found' }, { status: 404 })
    }

    const taskObj = updated.toObject()
    const normalizedTask = {
      ...taskObj,
      id: taskObj._id.toString(),
      comments: (Array.isArray((taskObj as any).comments) ? (taskObj as any).comments : []).map((item: any) => ({
        ...item,
        id: item.id || item._id
      }))
    }

    return NextResponse.json(normalizedTask, { status: 200 })
  } catch (error) {
    console.error('Error requesting task completion:', error)
    return NextResponse.json({ message: 'Failed to request task completion' }, { status: 500 })
  }
}
