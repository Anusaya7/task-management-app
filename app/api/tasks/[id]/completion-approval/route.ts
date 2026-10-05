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
    if (user.role !== 'Director' && user.role !== 'Project Head') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    await dbConnect()

    const { action, comment } = await request.json()

    if (!action || (action !== 'approve' && action !== 'reject')) {
      return NextResponse.json(
        { message: 'Invalid action. Must be "approve" or "reject"' },
        { status: 400 }
      )
    }

    const existing = await Task.findById(params.id)
    if (!existing) {
      return NextResponse.json({ message: 'Task not found' }, { status: 404 })
    }

    if (user.role === 'Project Head') {
      const allowedEmps = user.assignedEmployees || []
      const allowedProjs = user.assignedProjects || []
      const isAllowed = (existing.assignedEmployeeIds || []).some((id: string) => allowedEmps.includes(id)) ||
                        allowedProjs.includes(existing.projectId) ||
                        existing.projectHeadId === user._id.toString()
      if (!isAllowed) {
        return NextResponse.json({ error: 'Forbidden: Task outside assigned scope' }, { status: 403 })
      }
    }

    const updateData: any = {
      completionRequestStatus: action === 'approve' ? 'Approved' : 'Rejected',
      completionResponseDate: new Date(),
      completionResponseBy: user._id.toString(),
      completionResponseComment: comment || ''
    }

    if (action === 'approve') {
      updateData.status = 'Completed'
      updateData.completedDate = new Date().toISOString()
    }

    const task = await Task.findByIdAndUpdate(
      params.id,
      updateData,
      { new: true, runValidators: false }
    )

    if (!task) {
      return NextResponse.json({ message: 'Task not found' }, { status: 404 })
    }

    const taskObj = task.toObject()
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
    console.error('Error processing completion approval:', error)
    return NextResponse.json({ message: 'Failed to process completion approval' }, { status: 500 })
  }
}
