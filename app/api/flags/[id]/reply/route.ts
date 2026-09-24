import { NextResponse } from 'next/server'
import connectToDatabase from '@/lib/mongodb'
import Flag from '@/models/Flag'
import Task from '@/models/Task'
import { getAuthUser } from '@/lib/auth'
import { sendNotifications } from '@/lib/notifications'

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const user = await getAuthUser(req)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    await connectToDatabase()
    const { message } = await req.json()

    if (!message || !message.trim()) {
      return NextResponse.json({ error: 'Reply message is required' }, { status: 400 })
    }

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
    } else if (user.role === 'Employee' && flag.employeeId !== user._id.toString()) {
      return NextResponse.json({ error: 'Forbidden: Access denied to this flag' }, { status: 403 })
    }

    const userName = `${user.firstName} ${user.lastName}`

    if (!flag.replies) {
      flag.replies = []
    }

    flag.replies.push({
      userId: user._id.toString(),
      userName,
      userRole: user.role,
      message: message.trim(),
      createdAt: new Date()
    })

    await flag.save()

    const task = await Task.findById(flag.taskId)
    const taskTitle = flag.taskTitle || task?.title || 'Task'
    const projectId = task?.projectId

    if (user.role === 'Employee') {
      // Send notification to Director & Project Head
      await sendNotifications({
        recipientRoles: ['Director', 'Project Head'],
        projectId,
        employeeId: user._id.toString(),
        type: 'FLAG_REPLY',
        title: `${userName} replied to task flag`,
        message: `${userName} replied to flag on '${taskTitle}': "${message.trim()}"`,
        taskId: flag.taskId,
        relatedUserId: user._id.toString(),
        relatedUserName: userName
      })
    } else {
      // Send notification to assigned employee
      await sendNotifications({
        recipientUserId: flag.employeeId,
        type: 'FLAG_REPLY',
        title: `${user.role} replied to task flag`,
        message: `${user.role} (${userName}) replied to flag on '${taskTitle}': "${message.trim()}"`,
        taskId: flag.taskId,
        projectId,
        relatedUserId: user._id.toString(),
        relatedUserName: userName
      })
    }

    return NextResponse.json(flag)
  } catch (error: any) {
    console.error('Flag Reply API error:', error)
    return NextResponse.json({ error: 'Failed to post flag reply' }, { status: 500 })
  }
}
