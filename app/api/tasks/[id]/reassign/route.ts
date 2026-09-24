import { NextResponse } from 'next/server'
import connectToDatabase from '@/lib/mongodb'
import Task from '@/models/Task'
import Employee from '@/models/Employee'
import TaskAssignmentHistory from '@/models/TaskAssignmentHistory'
import TaskHistory from '@/models/TaskHistory'
import { getAuthUser, getTodayKolkata } from '@/lib/auth'

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  try {
    const user = await getAuthUser(req)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (user.role === 'Employee') {
      return NextResponse.json({ error: 'Forbidden: Employees cannot reassign tasks' }, { status: 403 })
    }

    await connectToDatabase()
    const { newEmployeeId, reason } = await req.json()

    if (!newEmployeeId) {
      return NextResponse.json({ error: 'New employee selection is required' }, { status: 400 })
    }

    const task = await Task.findById(params.id)
    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 })
    }

    const newEmp = await Employee.findById(newEmployeeId)
    if (!newEmp) {
      return NextResponse.json({ error: 'Selected employee does not exist' }, { status: 400 })
    }

    const previousEmployeeId = task.assignedEmployeeIds[0] || ''
    const today = getTodayKolkata()

    task.assignedEmployeeIds = [newEmp._id.toString()]
    task.assignedEmployeeNames = [`${newEmp.firstName} ${newEmp.lastName}`]
    task.status = 'Reassigned'
    task.updatedAt = new Date()
    await task.save()

    // Log reassignment history
    await TaskAssignmentHistory.create({
      taskId: task._id.toString(),
      previousEmployeeId,
      newEmployeeId: newEmp._id.toString(),
      assignedById: user._id.toString(),
      assignedByName: `${user.firstName} ${user.lastName}`,
      date: today,
      reason: reason ? reason.trim() : 'Reassigned by management'
    })

    await TaskHistory.create({
      taskId: task._id.toString(),
      date: today,
      employeeId: newEmp._id.toString(),
      employeeName: `${newEmp.firstName} ${newEmp.lastName}`,
      role: user.role,
      action: 'Task Reassigned',
      remark: `Reassigned from previous employee. Reason: ${reason || 'None'}`,
      workDone: task.workDone || 0,
      status: 'Reassigned'
    })

    return NextResponse.json(task)
  } catch (error: any) {
    console.error('Reassign API error:', error)
    return NextResponse.json({ error: 'Failed to reassign task' }, { status: 500 })
  }
}
