import { NextResponse } from 'next/server'
import connectToDatabase from '@/lib/mongodb'
import DailyEntry from '@/models/DailyEntry'
import { getAuthUser } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getAuthUser(req)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    await connectToDatabase()
    const entry = await DailyEntry.findById(params.id).lean()
    if (!entry) {
      return NextResponse.json({ error: 'Daily entry not found' }, { status: 404 })
    }

    if (user.role === 'Employee' && entry.employeeId !== user._id.toString()) {
      return NextResponse.json({ error: 'Forbidden: You can only view your own entries' }, { status: 403 })
    }

    if (user.role === 'Project Head') {
      const allowedEmployees = user.assignedEmployees || []
      const allowedProjects = user.assignedProjects || []
      const isAllowed = allowedEmployees.includes(entry.employeeId) || entry.employeeId === user._id.toString() || allowedProjects.includes(entry.projectId)
      if (!isAllowed) {
        return NextResponse.json({ error: 'Forbidden: Daily entry outside assigned scope' }, { status: 403 })
      }
    }

    return NextResponse.json(entry)
  } catch (error: any) {
    return NextResponse.json({ error: 'Failed to fetch daily entry' }, { status: 500 })
  }
}

export async function PUT(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getAuthUser(req)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    await connectToDatabase()
    const body = await req.json()
    const entry = await DailyEntry.findById(params.id)

    if (!entry) {
      return NextResponse.json({ error: 'Daily entry not found' }, { status: 404 })
    }

    if (user.role === 'Employee' && entry.employeeId !== user._id.toString()) {
      return NextResponse.json({ error: 'Forbidden: You can only edit your own entries' }, { status: 403 })
    }

    if (user.role === 'Project Head') {
      const allowedEmployees = user.assignedEmployees || []
      const allowedProjects = user.assignedProjects || []
      const isAllowed = allowedEmployees.includes(entry.employeeId) || entry.employeeId === user._id.toString() || allowedProjects.includes(entry.projectId)
      if (!isAllowed) {
        return NextResponse.json({ error: 'Forbidden: Cannot edit daily entry outside assigned scope' }, { status: 403 })
      }
    }

    if (body.taskTitle !== undefined && body.taskTitle.trim() !== '') entry.taskTitle = body.taskTitle.trim()
    if (body.details !== undefined && body.details.trim() !== '') entry.details = body.details.trim()
    if (body.actionTaken !== undefined) entry.actionTaken = body.actionTaken.trim()
    if (body.hours !== undefined) entry.hours = Number(body.hours)
    if (body.flagged !== undefined) entry.flagged = Boolean(body.flagged)
    if (body.flagComment !== undefined) entry.flagComment = body.flagComment.trim()
    if (body.status !== undefined) entry.status = body.status

    entry.updatedAt = new Date()
    await entry.save()

    return NextResponse.json(entry)
  } catch (error: any) {
    return NextResponse.json({ error: 'Failed to update daily entry' }, { status: 500 })
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getAuthUser(req)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    await connectToDatabase()
    const entry = await DailyEntry.findById(params.id)

    if (!entry) {
      return NextResponse.json({ error: 'Daily entry not found' }, { status: 404 })
    }

    if (user.role === 'Employee' && entry.employeeId !== user._id.toString()) {
      return NextResponse.json({ error: 'Forbidden: You can only delete your own entries' }, { status: 403 })
    }

    if (user.role === 'Project Head') {
      const allowedEmployees = user.assignedEmployees || []
      const allowedProjects = user.assignedProjects || []
      const isAllowed = allowedEmployees.includes(entry.employeeId) || entry.employeeId === user._id.toString() || allowedProjects.includes(entry.projectId)
      if (!isAllowed) {
        return NextResponse.json({ error: 'Forbidden: Cannot delete daily entry outside assigned scope' }, { status: 403 })
      }
    }

    await DailyEntry.findByIdAndDelete(params.id)
    return NextResponse.json({ message: 'Daily entry deleted successfully' })
  } catch (error: any) {
    return NextResponse.json({ error: 'Failed to delete daily entry' }, { status: 500 })
  }
}
