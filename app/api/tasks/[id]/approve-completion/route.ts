import { NextResponse } from 'next/server'
import connectToDatabase from '@/lib/mongodb'
import Task from '@/models/Task'
import TaskHistory from '@/models/TaskHistory'
import { getAuthUser, getTodayKolkata } from '@/lib/auth'
import { sendNotifications } from '@/lib/notifications'

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  try {
    const user = await getAuthUser(req)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only Director can approve task completion
    if (user.role !== 'Director') {
      return NextResponse.json({ error: 'Forbidden: Only Director can approve task completion' }, { status: 403 })
    }

    await connectToDatabase()
    const body = await req.json()
    const { approved, remarks } = body

    const task = await Task.findById(params.id)
    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 })
    }

    const today = getTodayKolkata()

    const directorName = `${user.firstName} ${user.lastName}`

    if (approved === true || approved === 'Yes') {
      task.status = 'Completed'
      task.approvedBy = user._id.toString()
      task.approvalDate = new Date()
      task.approvalRemarks = remarks || 'Completion approved by Director'
      task.updatedAt = new Date()
      await task.save()

      await TaskHistory.create({
        taskId: task._id.toString(),
        date: today,
        employeeId: user._id.toString(),
        employeeName: directorName,
        role: user.role,
        action: 'Completion Approved',
        remark: remarks || 'Completion approved by Director',
        workDone: 100,
        status: 'Completed'
      })

      // Send TASK_APPROVED notifications to assigned Employees & Project Head
      for (const empId of task.assignedEmployeeIds) {
        await sendNotifications({
          recipientUserId: empId,
          type: 'TASK_APPROVED',
          title: `Your task has been approved`,
          message: `Director approved completion of '${task.title}' in ${task.projectName}`,
          taskId: task._id.toString(),
          projectId: task.projectId,
          relatedUserId: user._id.toString(),
          relatedUserName: directorName
        })
      }

      await sendNotifications({
        recipientRoles: ['Project Head'],
        projectId: task.projectId,
        type: 'TASK_APPROVED',
        title: `Task completed and approved`,
        message: `Task '${task.title}' in ${task.projectName} completed and approved by Director`,
        taskId: task._id.toString(),
        relatedUserId: user._id.toString(),
        relatedUserName: directorName
      })
    } else {
      task.status = 'Revision Required'
      task.approvalRemarks = remarks || 'Completion rejected. Requires revisions.'
      task.updatedAt = new Date()
      await task.save()

      await TaskHistory.create({
        taskId: task._id.toString(),
        date: today,
        employeeId: user._id.toString(),
        employeeName: directorName,
        role: user.role,
        action: 'Returned for Revision',
        remark: remarks || 'Completion rejected. Requires revisions.',
        workDone: task.workDone || 90,
        status: 'Revision Required'
      })

      // Send RETURN_FOR_REVISION notification
      for (const empId of task.assignedEmployeeIds) {
        await sendNotifications({
          recipientUserId: empId,
          type: 'RETURN_FOR_REVISION',
          title: `Task Returned for Revision`,
          message: `Director requested revision on '${task.title}': ${remarks || 'Please review and update.'}`,
          taskId: task._id.toString(),
          projectId: task.projectId,
          relatedUserId: user._id.toString(),
          relatedUserName: directorName
        })
      }
    }

    return NextResponse.json(task)
  } catch (error: any) {
    console.error('Approve Completion API error:', error)
    return NextResponse.json({ error: 'Failed to approve task completion' }, { status: 500 })
  }
}
