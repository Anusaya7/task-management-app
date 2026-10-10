import { NextResponse } from 'next/server'
import connectToDatabase from '@/lib/mongodb'
import DailyEntry from '@/models/DailyEntry'
import { getAuthUser } from '@/lib/auth'
import { parseTimeInput } from '@/lib/timeFormat'

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
    const entry = await DailyEntry.findById(params.id).select('-attachments.data').lean()
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
    if (body.actionTaken !== undefined) {
      if (typeof body.actionTaken !== 'string' || !body.actionTaken.trim()) {
        return NextResponse.json({ error: 'Action Taken cannot be empty.' }, { status: 400 })
      }
      const nextActionTaken = body.actionTaken.trim()
      if (nextActionTaken !== entry.actionTaken) {
        const editedAt = new Date()
        entry.commentHistory = [
          ...(entry.commentHistory || []),
          {
            previousContent: entry.actionTaken,
            updatedContent: nextActionTaken,
            editorId: user._id.toString(),
            editorName: `${user.firstName} ${user.lastName}`.trim(),
            editorRole: user.role,
            editedAt
          }
        ]
        entry.commentLastEditedByName = `${user.firstName} ${user.lastName}`.trim()
        entry.commentLastEditedAt = editedAt
      }
      entry.actionTaken = nextActionTaken
    }
    if (body.hours !== undefined) {
      const parsedHours = parseTimeInput(body.hours)
      if (!parsedHours.ok) {
        return NextResponse.json({ error: parsedHours.error }, { status: 400 })
      }
      entry.hours = parsedHours.hours
    }
    if (body.flagged !== undefined) entry.flagged = Boolean(body.flagged)
    if (body.flagComment !== undefined) entry.flagComment = body.flagComment.trim()
    if (body.status !== undefined) {
      const nextStatus = typeof body.status === 'string' ? body.status.trim() : ''
      if (nextStatus !== 'In Progress' && nextStatus !== 'Completed') {
        return NextResponse.json({ error: 'Please select task status before submitting.' }, { status: 400 })
      }
      entry.status = nextStatus
    }

    entry.updatedAt = new Date()
    await entry.save()

    return NextResponse.json(entry)
  } catch (error: any) {
    return NextResponse.json({ error: 'Failed to update daily entry' }, { status: 500 })
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getAuthUser(req)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (user.role !== 'Director' && user.role !== 'Project Head') {
      return NextResponse.json({ error: 'Only management can review daily entries' }, { status: 403 })
    }

    await connectToDatabase()
    const entry = await DailyEntry.findById(params.id)
    if (!entry) {
      return NextResponse.json({ error: 'Daily entry not found' }, { status: 404 })
    }

    if (user.role === 'Project Head') {
      const allowedEmployees = user.assignedEmployees || []
      const allowedProjects = user.assignedProjects || []
      const isAllowed =
        allowedEmployees.includes(entry.employeeId) ||
        entry.employeeId === user._id.toString() ||
        allowedProjects.includes(entry.projectId)
      if (!isAllowed) {
        return NextResponse.json({ error: 'Forbidden: Daily entry outside assigned scope' }, { status: 403 })
      }
    }

    entry.reviewedById = user._id.toString()
    entry.reviewedByName = `${user.firstName} ${user.lastName}`.trim()
    entry.reviewedAt = new Date()
    entry.updatedAt = new Date()
    await entry.save()

    return NextResponse.json(entry)
  } catch (error) {
    console.error('DailyEntry PATCH error:', error)
    return NextResponse.json({ error: 'Failed to review daily entry' }, { status: 500 })
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
