import { NextResponse } from 'next/server'
import connectToDatabase from '@/lib/mongodb'
import Task from '@/models/Task'
import TaskHistory from '@/models/TaskHistory'
import Reminder from '@/models/Reminder'
import Attendance from '@/models/Attendance'
import Employee from '@/models/Employee'
import { getTodayKolkata } from '@/lib/auth'

export async function POST(req: Request) {
  try {
    await connectToDatabase()
    const today = getTodayKolkata()

    // 1. Process Un-updated Tasks for Active Employees
    const activeEmployees = await Employee.find({ status: 'Active', role: 'Employee' })
    let notUpdatedCount = 0

    for (const emp of activeEmployees) {
      const empIdStr = emp._id.toString()
      const pendingTasks = await Task.find({
        assignedEmployeeIds: empIdStr,
        status: { $in: ['Pending', 'In Progress'] }
      })

      for (const task of pendingTasks) {
        const taskIdStr = task._id.toString()
        const historyExists = await TaskHistory.findOne({
          taskId: taskIdStr,
          employeeId: empIdStr,
          date: today
        })

        if (!historyExists) {
          await TaskHistory.create({
            taskId: taskIdStr,
            date: today,
            employeeId: empIdStr,
            employeeName: `${emp.firstName} ${emp.lastName}`,
            role: 'Employee',
            action: 'Not Updated',
            remark: 'No daily work update submitted by employee',
            workDone: task.workDone || 0,
            status: 'Not Updated'
          })
          notUpdatedCount++
        }
      }
    }

    // 2. Process Overdue Unanswered Reminders
    const overdueReminders = await Reminder.find({
      reminderDate: { $lte: today },
      status: 'Pending'
    })

    let notRepliedCount = 0
    for (const rem of overdueReminders) {
      rem.status = 'Not Replied'
      await rem.save()
      notRepliedCount++

      const task = await Task.findById(rem.taskId)
      if (task) {
        task.status = 'Not Replied'
        await task.save()
      }
    }

    // 3. Process Absence Carry-Forward
    const absentRecords = await Attendance.find({ date: today, status: 'Absent' })
    let carryForwardCount = 0

    for (const att of absentRecords) {
      const empIdStr = att.employeeId
      const pendingTasks = await Task.find({
        assignedEmployeeIds: empIdStr,
        status: { $in: ['Pending', 'In Progress'] }
      })

      for (const task of pendingTasks) {
        task.status = 'Carried Forward'
        await task.save()

        const taskIdStr = task._id.toString()
        const cfHistoryExists = await TaskHistory.findOne({
          taskId: taskIdStr,
          employeeId: empIdStr,
          date: today,
          action: 'Carried Forward (Absent)'
        })

        if (!cfHistoryExists) {
          await TaskHistory.create({
            taskId: taskIdStr,
            date: today,
            employeeId: empIdStr,
            employeeName: att.employeeName,
            role: 'Employee',
            action: 'Carried Forward (Absent)',
            remark: 'Employee marked absent. Task carried forward to next working day.',
            workDone: task.workDone || 0,
            status: 'Carried Forward'
          })
          carryForwardCount++
        }
      }
    }

    return NextResponse.json({
      success: true,
      processedDate: today,
      summary: {
        notUpdatedLogged: notUpdatedCount,
        notRepliedLogged: notRepliedCount,
        tasksCarriedForward: carryForwardCount
      }
    })
  } catch (error: any) {
    console.error('Daily Cutoff Processing error:', error)
    return NextResponse.json({ error: 'Daily cutoff failed', details: error.message }, { status: 500 })
  }
}
