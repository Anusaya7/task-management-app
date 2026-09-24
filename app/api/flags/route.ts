import { NextResponse } from 'next/server'
import connectToDatabase from '@/lib/mongodb'
import Flag from '@/models/Flag'
import Task from '@/models/Task'
import { getAuthUser, getTodayKolkata } from '@/lib/auth'
import { sendNotifications } from '@/lib/notifications'

export async function GET(req: Request) {
  try {
    const user = await getAuthUser(req)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    await connectToDatabase()

    if (user.role === 'Director') {
      const flags = await Flag.find().sort({ createdAt: -1 })
      return NextResponse.json(flags)
    }

    if (user.role === 'Project Head') {
      const allowed = user.assignedEmployees || []
      const flags = await Flag.find({
        $or: [
          { employeeId: { $in: allowed } },
          { employeeId: user._id.toString() }
        ]
      }).sort({ createdAt: -1 })
      return NextResponse.json(flags)
    }

    // Employee role: own flags
    const flags = await Flag.find({ employeeId: user._id.toString() }).sort({ createdAt: -1 })
    return NextResponse.json(flags)
  } catch (error: any) {
    console.error('Flags GET API error:', error)
    return NextResponse.json({ error: 'Failed to fetch flags' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const user = await getAuthUser(req)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    await connectToDatabase()
    const { taskId, flagType, flagMessage } = await req.json()

    if (!taskId || !flagMessage) {
      return NextResponse.json({ error: 'Task and Flag Message are required' }, { status: 400 })
    }

    const task = await Task.findById(taskId)
    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 })
    }

    const today = getTodayKolkata()
    const creatorName = `${user.firstName} ${user.lastName}`

    task.flagStatus = 'Open'
    task.flagMessage = flagMessage.trim()
    task.flagDate = today
    await task.save()

    const typeStr = flagType || 'Needs Attention'

    const flag = await Flag.create({
      taskId: task._id.toString(),
      taskTitle: task.title,
      employeeId: task.assignedEmployeeIds[0] || user._id.toString(),
      employeeName: task.assignedEmployeeNames ? task.assignedEmployeeNames[0] : creatorName,
      createdBy: user._id.toString(),
      createdByRole: user.role,
      flagType: typeStr,
      flagMessage: flagMessage.trim(),
      flagDate: today,
      status: 'Open'
    })

    // Send notification to assigned employees if created by Director/PH
    if (user.role !== 'Employee') {
      for (const empId of task.assignedEmployeeIds) {
        await sendNotifications({
          recipientUserId: empId,
          type: 'TASK_FLAGGED',
          title: `${user.role} flagged your task`,
          message: `${user.role} flagged '${task.title}': ${typeStr} - ${flagMessage.trim()}`,
          taskId: task._id.toString(),
          projectId: task.projectId,
          relatedUserId: user._id.toString(),
          relatedUserName: creatorName
        })
      }
    } else {
      // Employee created flag -> notify Director & PH
      await sendNotifications({
        recipientRoles: ['Director', 'Project Head'],
        projectId: task.projectId,
        employeeId: user._id.toString(),
        type: 'TASK_FLAGGED',
        title: `${creatorName} flagged task`,
        message: `${creatorName} flagged '${task.title}': ${flagMessage.trim()}`,
        taskId: task._id.toString(),
        relatedUserId: user._id.toString(),
        relatedUserName: creatorName
      })
    }

    return NextResponse.json(flag, { status: 201 })
  } catch (error: any) {
    console.error('Flags POST API error:', error)
    return NextResponse.json({ error: 'Failed to flag task' }, { status: 500 })
  }
}
