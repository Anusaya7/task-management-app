import { NextResponse } from 'next/server'
import connectToDatabase from '@/lib/mongodb'
import Flag from '@/models/Flag'
import Task from '@/models/Task'
import { getAuthUser } from '@/lib/auth'
import { sendNotifications } from '@/lib/notifications'

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  try {
    const user = await getAuthUser(req)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (user.role === 'Employee') {
      return NextResponse.json({ error: 'Forbidden: Employees cannot resolve management flags' }, { status: 403 })
    }

    await connectToDatabase()
    const { response } = await req.json()

    const flag = await Flag.findById(params.id)
    if (!flag) {
      return NextResponse.json({ error: 'Flag not found' }, { status: 404 })
    }

    if (user.role === 'Project Head') {
      const allowed = user.assignedEmployees || []
      const isAllowed = allowed.includes(flag.employeeId) || flag.employeeId === user._id.toString()
      if (!isAllowed) {
        return NextResponse.json({ error: 'Forbidden: Access denied to this flag' }, { status: 403 })
      }
    }

    flag.status = 'Resolved'
    flag.managementResponse = response ? response.trim() : 'Flag resolved by management'
    flag.resolvedBy = `${user.firstName} ${user.lastName}`
    flag.resolvedAt = new Date()
    await flag.save()

    // Clear open flag on task
    const task = await Task.findById(flag.taskId)
    if (task) {
      task.flagStatus = 'Resolved'
      await task.save()
    }

    // Send notification to employee
    const managerName = `${user.firstName} ${user.lastName}`
    await sendNotifications({
      recipientUserId: flag.employeeId,
      type: 'TASK_FLAGGED',
      title: `Task Flag Resolved`,
      message: `${user.role} (${managerName}) resolved flag on '${flag.taskTitle || 'Task'}'`,
      taskId: flag.taskId,
      relatedUserId: user._id.toString(),
      relatedUserName: managerName
    })

    return NextResponse.json(flag)
  } catch (error: any) {
    console.error('Resolve Flag API error:', error)
    return NextResponse.json({ error: 'Failed to resolve flag' }, { status: 500 })
  }
}
