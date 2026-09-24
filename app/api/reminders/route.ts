import { NextResponse } from 'next/server'
import connectToDatabase from '@/lib/mongodb'
import Reminder from '@/models/Reminder'
import Task from '@/models/Task'
import Employee from '@/models/Employee'
import { getAuthUser, getTodayKolkata } from '@/lib/auth'

export async function GET(req: Request) {
  try {
    const user = await getAuthUser(req)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    await connectToDatabase()

    if (user.role === 'Director') {
      const reminders = await Reminder.find().sort({ reminderDate: -1 })
      return NextResponse.json(reminders)
    }

    if (user.role === 'Project Head') {
      const allowed = user.assignedEmployees || []
      const reminders = await Reminder.find({
        $or: [
          { employeeId: { $in: allowed } },
          { employeeId: user._id.toString() }
        ]
      }).sort({ reminderDate: -1 })
      return NextResponse.json(reminders)
    }

    // Employee role: own reminders
    const reminders = await Reminder.find({ employeeId: user._id.toString() }).sort({ reminderDate: -1 })
    return NextResponse.json(reminders)
  } catch (error: any) {
    console.error('Reminders GET API error:', error)
    return NextResponse.json({ error: 'Failed to fetch reminders' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const user = await getAuthUser(req)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    await connectToDatabase()
    const body = await req.json()
    const { taskId, employeeId, reminderDate, message, title } = body

    const today = getTodayKolkata()
    const targetDate = reminderDate || today

    let targetEmpId = user._id.toString()
    let targetEmpName = `${user.firstName} ${user.lastName}`

    if (user.role !== 'Employee' && employeeId) {
      const emp = await Employee.findById(employeeId)
      if (emp) {
        targetEmpId = emp._id.toString()
        targetEmpName = `${emp.firstName} ${emp.lastName}`
      }
    }

    // Backend enforcement of maximum 10 reminders per employee per date
    const existingCount = await Reminder.countDocuments({
      employeeId: targetEmpId,
      reminderDate: targetDate
    })

    if (existingCount >= 10) {
      return NextResponse.json({ error: 'Daily reminder limit of 10 reached.' }, { status: 400 })
    }

    const reminderContent = (message || title || '').trim()
    if (!reminderContent) {
      return NextResponse.json({ error: 'Reminder details/title is required' }, { status: 400 })
    }

    let resolvedTaskTitle = title || reminderContent
    let resolvedTaskId = taskId || 'GENERAL'

    if (taskId && taskId !== 'GENERAL') {
      const task = await Task.findById(taskId)
      if (task) {
        resolvedTaskTitle = task.title
        resolvedTaskId = task._id.toString()
      }
    }

    const reminder = await Reminder.create({
      taskId: resolvedTaskId,
      taskTitle: resolvedTaskTitle,
      employeeId: targetEmpId,
      employeeName: targetEmpName,
      reminderDate: targetDate,
      message: reminderContent,
      status: 'Pending'
    })

    return NextResponse.json(reminder, { status: 201 })
  } catch (error: any) {
    console.error('Reminders POST API error:', error)
    return NextResponse.json({ error: 'Failed to create reminder' }, { status: 500 })
  }
}
