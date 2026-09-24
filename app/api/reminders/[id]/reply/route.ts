import { NextResponse } from 'next/server'
import connectToDatabase from '@/lib/mongodb'
import Reminder from '@/models/Reminder'
import TaskHistory from '@/models/TaskHistory'
import { getAuthUser, getTodayKolkata } from '@/lib/auth'

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  try {
    const user = await getAuthUser(req)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    await connectToDatabase()
    const { response } = await req.json()

    if (!response || !response.trim()) {
      return NextResponse.json({ error: 'Response content is required' }, { status: 400 })
    }

    const reminder = await Reminder.findById(params.id)
    if (!reminder) {
      return NextResponse.json({ error: 'Reminder not found' }, { status: 404 })
    }

    if (reminder.employeeId !== user._id.toString() && user.role === 'Employee') {
      return NextResponse.json({ error: 'Forbidden: You can only reply to your own reminders' }, { status: 403 })
    }

    const today = getTodayKolkata()

    reminder.status = 'Replied'
    reminder.response = response.trim()
    reminder.responseDate = new Date()
    await reminder.save()

    // Log in TaskHistory
    await TaskHistory.create({
      taskId: reminder.taskId,
      date: today,
      employeeId: user._id.toString(),
      employeeName: `${user.firstName} ${user.lastName}`,
      role: user.role,
      action: 'Reminder Replied',
      remark: response.trim(),
      workDone: 0,
      status: 'Replied'
    })

    return NextResponse.json(reminder)
  } catch (error: any) {
    console.error('Reminder Reply API error:', error)
    return NextResponse.json({ error: 'Failed to reply to reminder' }, { status: 500 })
  }
}
