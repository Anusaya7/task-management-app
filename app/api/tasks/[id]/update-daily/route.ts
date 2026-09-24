import { NextResponse } from 'next/server'
import connectToDatabase from '@/lib/mongodb'
import Task from '@/models/Task'
import TaskHistory from '@/models/TaskHistory'
import Flag from '@/models/Flag'
import { getAuthUser, getTodayKolkata } from '@/lib/auth'
import { sendNotifications } from '@/lib/notifications'

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  try {
    const user = await getAuthUser(req)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    await connectToDatabase()
    const task = await Task.findById(params.id)
    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 })
    }

    // Verify assigned employee or Director/PH
    const isAssigned = task.assignedEmployeeIds.includes(user._id.toString())
    if (!isAssigned && user.role === 'Employee') {
      return NextResponse.json({ error: 'Forbidden: You can only update tasks assigned to you' }, { status: 403 })
    }

    const body = await req.json()
    const { workDone, remark, flagMessage, date } = body

    const today = getTodayKolkata()
    const targetDate = date || today

    // Same-day editing rule check
    if (targetDate !== today && user.role === 'Employee') {
      return NextResponse.json({ error: 'Past daily entries are read-only and cannot be modified' }, { status: 400 })
    }

    const numWorkDone = Number(workDone)
    if (isNaN(numWorkDone) || numWorkDone < 0 || numWorkDone > 100) {
      return NextResponse.json({ error: 'Work Done percentage must be between 10% and 100%' }, { status: 400 })
    }

    const prevWorkDone = task.workDone || 0

    // Determine updated status
    let newStatus = task.status
    if (numWorkDone === 100) {
      newStatus = 'Pending Approval'
      task.completionRequestedDate = new Date()
    } else if (task.status === 'Pending' || task.status === 'Revision Required') {
      newStatus = 'In Progress'
    }

    task.workDone = numWorkDone
    task.status = newStatus
    task.updatedAt = new Date()

    const empName = `${user.firstName} ${user.lastName}`

    // Handle Optional Flag
    if (flagMessage && flagMessage.trim()) {
      task.flagStatus = 'Open'
      task.flagMessage = flagMessage.trim()
      task.flagDate = today

      await Flag.create({
        taskId: task._id.toString(),
        taskTitle: task.title,
        employeeId: user._id.toString(),
        employeeName: empName,
        createdBy: user._id.toString(),
        createdByRole: user.role,
        flagType: 'Needs Attention',
        flagMessage: flagMessage.trim(),
        flagDate: today,
        status: 'Open'
      })

      // Send flag notification to Director and PH
      await sendNotifications({
        recipientRoles: ['Director', 'Project Head'],
        projectId: task.projectId,
        employeeId: user._id.toString(),
        type: 'TASK_FLAGGED',
        title: `${empName} flagged task`,
        message: `${empName} flagged '${task.title}' in ${task.projectName}: ${flagMessage.trim()}`,
        taskId: task._id.toString(),
        relatedUserId: user._id.toString(),
        relatedUserName: empName
      })
    }

    await task.save()

    // Create immutable history record for today
    await TaskHistory.create({
      taskId: task._id.toString(),
      date: today,
      employeeId: user._id.toString(),
      employeeName: empName,
      role: user.role,
      action: numWorkDone === 100 ? 'Requested Completion (100%)' : 'Daily Work Update',
      remark: remark ? remark.trim() : 'Updated work progress',
      workDone: numWorkDone,
      status: newStatus
    })

    // Send Progress Update Notifications to Director and responsible Project Head
    if (numWorkDone === 100) {
      await sendNotifications({
        recipientRoles: ['Director', 'Project Head'],
        projectId: task.projectId,
        employeeId: user._id.toString(),
        type: 'TASK_SUBMITTED_FOR_APPROVAL',
        title: `${empName} submitted '${task.title}' for approval`,
        message: `${empName} updated '${task.title}' in ${task.projectName} to 100%. Pending Director completion approval.`,
        taskId: task._id.toString(),
        relatedUserId: user._id.toString(),
        relatedUserName: empName,
        previousWorkDone: prevWorkDone,
        newWorkDone: 100
      })
    } else {
      await sendNotifications({
        recipientRoles: ['Director', 'Project Head'],
        projectId: task.projectId,
        employeeId: user._id.toString(),
        type: 'TASK_PROGRESS_UPDATED',
        title: `${empName} updated '${task.title}' to ${numWorkDone}%`,
        message: `${empName} updated '${task.title}' (${prevWorkDone}% → ${numWorkDone}%) in ${task.projectName}.`,
        taskId: task._id.toString(),
        relatedUserId: user._id.toString(),
        relatedUserName: empName,
        previousWorkDone: prevWorkDone,
        newWorkDone: numWorkDone
      })
    }

    return NextResponse.json(task)
  } catch (error: any) {
    console.error('Update Daily API error:', error)
    return NextResponse.json({ error: 'Failed to update daily work' }, { status: 500 })
  }
}
