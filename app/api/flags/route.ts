import { NextResponse } from 'next/server'
import connectToDatabase from '@/lib/mongodb'
import Flag from '@/models/Flag'
import Task from '@/models/Task'
import Employee from '@/models/Employee'
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
          { employeeId: user._id.toString() },
          { concernedPersonId: user._id.toString() },
          { createdBy: user._id.toString() }
        ]
      }).sort({ createdAt: -1 })
      return NextResponse.json(flags)
    }

    // Employee role: own flags or flags assigned to them
    const flags = await Flag.find({
      $or: [
        { employeeId: user._id.toString() },
        { createdBy: user._id.toString() },
        { concernedPersonId: user._id.toString() }
      ]
    }).sort({ createdAt: -1 })
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
    const { taskId, flagType, flagMessage, concernedPersonId } = await req.json()

    if (!taskId || !flagMessage) {
      return NextResponse.json({ error: 'Task and Flag Message are required' }, { status: 400 })
    }

    const task = await Task.findById(taskId)
    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 })
    }

    const today = getTodayKolkata()
    const creatorName = `${user.firstName} ${user.lastName}`
    let concernedId = concernedPersonId || (user.role === 'Employee' ? '' : (task.assignedEmployeeIds[0] || ''))
    let concernedName = ''
    if (concernedId) {
      const concerned = await Employee.findById(concernedId).select('_id firstName lastName')
      if (!concerned) {
        return NextResponse.json({ error: 'Selected concerned person was not found' }, { status: 400 })
      }
      concernedId = concerned._id.toString()
      concernedName = `${concerned.firstName} ${concerned.lastName}`
    } else if (user.role !== 'Employee') {
      concernedId = task.assignedEmployeeIds[0] || user._id.toString()
      concernedName = task.assignedEmployeeNames ? task.assignedEmployeeNames[0] : creatorName
    } else {
      return NextResponse.json({ error: 'Please assign the flag to a concerned person.' }, { status: 400 })
    }

    task.flagStatus = 'Open'
    task.flagMessage = flagMessage.trim()
    task.flagDate = today
    await task.save()

    const typeStr = flagType || 'Needs Attention'

    const existingOpen = await Flag.findOne({
      taskId: task._id.toString(),
      createdBy: user._id.toString(),
      concernedPersonId: concernedId,
      status: 'Open'
    })
    if (existingOpen) {
      existingOpen.flagMessage = flagMessage.trim()
      existingOpen.flagType = typeStr
      existingOpen.flagDate = today
      await existingOpen.save()
      return NextResponse.json(existingOpen)
    }

    const flag = await Flag.create({
      taskId: task._id.toString(),
      taskTitle: task.title,
      projectId: task.projectId,
      projectName: task.projectName || 'Project',
      employeeId: user._id.toString(),
      employeeName: creatorName,
      createdBy: user._id.toString(),
      createdByName: creatorName,
      createdByRole: user.role,
      concernedPersonId: concernedId,
      concernedPersonName: concernedName,
      flagType: typeStr,
      flagMessage: flagMessage.trim(),
      flagDate: today,
      status: 'Open'
    })

    if (concernedId !== user._id.toString()) {
      await sendNotifications({
        recipientUserId: concernedId,
        type: 'TASK_FLAGGED',
        title: `${creatorName} assigned a flag`,
        message: `${creatorName} flagged '${task.title}': ${typeStr} - ${flagMessage.trim()}`,
        taskId: task._id.toString(),
        projectId: task.projectId,
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
