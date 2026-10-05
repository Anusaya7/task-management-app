import { NextResponse } from 'next/server'
import connectToDatabase from '@/lib/mongodb'
import Reminder from '@/models/Reminder'
import { getAuthUser } from '@/lib/auth'

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  try {
    const user = await getAuthUser(req)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    await connectToDatabase()
    const body = await req.json().catch(() => ({}))
    const reminder = await Reminder.findById(params.id)
    if (!reminder) {
      return NextResponse.json({ error: 'Reminder not found' }, { status: 404 })
    }

    if (user.role === 'Employee' && reminder.employeeId !== user._id.toString()) {
      return NextResponse.json({ error: 'Forbidden: You can only close your own reminders' }, { status: 403 })
    }

    if (user.role === 'Project Head') {
      const allowed = user.assignedEmployees || []
      const isAllowed = allowed.includes(reminder.employeeId) || reminder.employeeId === user._id.toString()
      if (!isAllowed) {
        return NextResponse.json({ error: 'Forbidden: Reminder outside assigned scope' }, { status: 403 })
      }
    }

    const nextStatus = body.status === 'Completed' ? 'Completed' : 'Closed'
    reminder.status = nextStatus
    if (body.response && String(body.response).trim()) {
      reminder.response = String(body.response).trim()
      reminder.responseDate = new Date()
    }
    await reminder.save()

    return NextResponse.json(reminder)
  } catch (error: any) {
    console.error('Reminder close API error:', error)
    return NextResponse.json({ error: 'Failed to close reminder' }, { status: 500 })
  }
}
