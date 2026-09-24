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

    if (user.role !== 'Director') {
      return NextResponse.json({ error: 'Forbidden: Only Directors can return tasks for revision' }, { status: 403 })
    }

    await connectToDatabase()
    const task = await Task.findById(params.id)
    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 })
    }

    const { remark } = await req.json()
    const today = getTodayKolkata()
    const directorName = `${user.firstName} ${user.lastName}`

    task.status = 'Revision Required'
    task.updatedAt = new Date()
    await task.save()

    // Create immutable history record
    await TaskHistory.create({
      taskId: task._id.toString(),
      date: today,
      employeeId: user._id.toString(),
      employeeName: directorName,
      role: 'Director',
      action: 'Returned for Revision',
      remark: remark ? remark.trim() : 'Revision requested by Director',
      workDone: task.workDone || 0,
      status: 'Revision Required'
    })

    // Notify assigned employees
    for (const empId of task.assignedEmployeeIds) {
      await sendNotifications({
        recipientUserId: empId,
        type: 'RETURN_FOR_REVISION',
        title: `Task Returned for Revision`,
        message: `Director requested revision for '${task.title}': ${remark || 'Please review and update drawing/work.'}`,
        taskId: task._id.toString(),
        projectId: task.projectId,
        relatedUserId: user._id.toString(),
        relatedUserName: directorName
      })
    }

    return NextResponse.json(task)
  } catch (error: any) {
    console.error('Return Revision API error:', error)
    return NextResponse.json({ error: 'Failed to return task for revision' }, { status: 500 })
  }
}
