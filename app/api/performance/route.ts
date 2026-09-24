import { NextResponse } from 'next/server'
import connectToDatabase from '@/lib/mongodb'
import Employee from '@/models/Employee'
import Task from '@/models/Task'
import TaskHistory from '@/models/TaskHistory'
import Reminder from '@/models/Reminder'
import Attendance from '@/models/Attendance'
import Flag from '@/models/Flag'
import PrivateRating from '@/models/PrivateRating'
import DailyEntry from '@/models/DailyEntry'
import { getAuthUser, getTodayKolkata } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  try {
    const user = await getAuthUser(req)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    await connectToDatabase()
    const { searchParams } = new URL(req.url)
    const reqEmpId = searchParams.get('employeeId')

    let employees = []
    if (user.role === 'Director') {
      if (reqEmpId) {
        employees = await Employee.find({ _id: reqEmpId })
      } else {
        employees = await Employee.find({ role: 'Employee' })
      }
    } else if (user.role === 'Project Head') {
      const allowed = user.assignedEmployees || []
      employees = await Employee.find({ _id: { $in: allowed } })
    } else {
      // Employee role: strictly self only
      if (reqEmpId && reqEmpId !== user._id.toString()) {
        return NextResponse.json({ error: 'Forbidden: You can only view your own performance' }, { status: 403 })
      }
      employees = await Employee.find({ _id: user._id })
    }

    const today = getTodayKolkata()

    // Determine current calendar week and month boundaries in Asia/Kolkata
    const [yr, mo, dy] = today.split('-').map(Number)
    const kolkataNow = new Date(Date.UTC(yr, mo - 1, dy))

    // Day of week: 0 = Sun, 1 = Mon, ..., 6 = Sat
    const dayOfWeek = kolkataNow.getUTCDay()
    const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek

    const mondayDate = new Date(kolkataNow)
    mondayDate.setUTCDate(kolkataNow.getUTCDate() + diffToMonday)
    const weekStartStr = mondayDate.toISOString().substring(0, 10)

    const sundayDate = new Date(mondayDate)
    sundayDate.setUTCDate(mondayDate.getUTCDate() + 6)
    const weekEndStr = sundayDate.toISOString().substring(0, 10)

    // Current calendar month bounds
    const monthStartStr = `${yr}-${String(mo).padStart(2, '0')}-01`
    const lastDayOfMonth = new Date(Date.UTC(yr, mo, 0)).getUTCDate()
    const monthEndStr = `${yr}-${String(mo).padStart(2, '0')}-${String(lastDayOfMonth).padStart(2, '0')}`

    const performanceReport = []

    for (const emp of employees) {
      const empIdStr = emp._id.toString()

      const tasks = await Task.find({ assignedEmployeeIds: empIdStr })
      const tasksAssigned = tasks.length
      const tasksCompleted = tasks.filter(t => t.status === 'Completed').length
      const tasksPending = tasks.filter(t => ['Pending', 'In Progress', 'Pending Approval'].includes(t.status)).length
      const tasksOverdue = tasks.filter(t => {
        if (['Completed'].includes(t.status)) return false
        return t.dueDate && t.dueDate < today
      }).length
      const tasksCompletedOnTime = tasks.filter(t => {
        if (t.status !== 'Completed') return false
        if (!t.dueDate) return true
        const doneDate = t.approvalDate ? new Date(t.approvalDate).toISOString().substring(0, 10) : today
        return doneDate <= t.dueDate
      }).length

      const totalWork = tasks.reduce((acc, t) => acc + (t.workDone || 0), 0)
      const workDonePercentage = tasksAssigned > 0 ? Math.round(totalWork / tasksAssigned) : 0

      const tasksCarriedForward = tasks.filter(t => t.status === 'Carried Forward').length
      const tasksReassigned = tasks.filter(t => t.status === 'Reassigned').length

      const notUpdatedCount = await TaskHistory.countDocuments({ employeeId: empIdStr, action: 'Not Updated' })
      const notRepliedCount = await Reminder.countDocuments({ employeeId: empIdStr, status: 'Not Replied' })
      const absentDays = await Attendance.countDocuments({ employeeId: empIdStr, status: 'Absent' })
      const flaggedTasksCount = await Flag.countDocuments({ employeeId: empIdStr })

      // Rating/Marking from Director Ratings (or default 4.5/5)
      const ratings = await PrivateRating.find({ employeeId: empIdStr })
      let markingScore = 4.5
      if (ratings.length > 0) {
        const sum = ratings.reduce((acc, r) => acc + r.rating, 0)
        markingScore = Math.round((sum / ratings.length) * 10) / 10
      }

      // Calculate Weekly and Monthly metrics from Daily Entries
      const dailyEntries = await DailyEntry.find({ employeeId: empIdStr }).lean()

      // Helper function for metric calculation
      const calcMetrics = (startDateStr: string, endDateStr: string) => {
        const effectiveEnd = endDateStr < today ? endDateStr : today
        const hoursByDate: Record<string, number> = {}

        for (const entry of dailyEntries) {
          if (entry.date >= startDateStr && entry.date <= endDateStr) {
            hoursByDate[entry.date] = (hoursByDate[entry.date] || 0) + (Number(entry.hours) || 0)
          }
        }

        let totalWorkHours = 0
        let totalFreeHours = 0

        const cur = new Date(startDateStr + 'T00:00:00Z')
        const end = new Date(effectiveEnd + 'T00:00:00Z')

        while (cur <= end) {
          const dStr = cur.toISOString().substring(0, 10)
          const day = cur.getUTCDay()
          const dayHours = hoursByDate[dStr] || 0

          if (day >= 1 && day <= 5) {
            // Weekday: 8 available hours logic
            const logged = Math.min(8, dayHours)
            totalWorkHours += dayHours
            totalFreeHours += Math.max(0, 8 - logged)
          } else {
            // Weekend
            totalWorkHours += dayHours
          }
          cur.setUTCDate(cur.getUTCDate() + 1)
        }

        const rangeEntries = dailyEntries.filter(e => e.date >= startDateStr && e.date <= endDateStr)
        const rangeCompletedTasks = tasks.filter(t => {
          if (t.status !== 'Completed' || !t.approvalDate) return false
          const doneStr = new Date(t.approvalDate).toISOString().substring(0, 10)
          return doneStr >= startDateStr && doneStr <= endDateStr
        }).length

        return {
          workDone: rangeEntries.length + rangeCompletedTasks,
          workHours: Math.round(totalWorkHours * 10) / 10,
          freeHours: Math.round(totalFreeHours * 10) / 10
        }
      }

      const weeklyMetrics = calcMetrics(weekStartStr, weekEndStr)
      const monthlyMetrics = calcMetrics(monthStartStr, monthEndStr)

      performanceReport.push({
        employeeId: empIdStr,
        employeeName: `${emp.firstName} ${emp.lastName}`,
        tasksAssigned,
        tasksCompleted,
        tasksPending,
        tasksOverdue,
        tasksCompletedOnTime,
        workDonePercentage,
        tasksCarriedForward,
        tasksReassigned,
        notUpdatedCount,
        notRepliedCount,
        absentDays,
        flaggedTasksCount,
        directorRating: markingScore,
        weekly: {
          workDone: weeklyMetrics.workDone,
          workHours: weeklyMetrics.workHours,
          freeHours: weeklyMetrics.freeHours,
          marking: markingScore
        },
        monthly: {
          workDone: monthlyMetrics.workDone,
          workHours: monthlyMetrics.workHours,
          freeHours: monthlyMetrics.freeHours,
          marking: markingScore
        }
      })
    }

    return NextResponse.json(performanceReport)
  } catch (error: any) {
    console.error('Performance GET error:', error)
    return NextResponse.json({ error: 'Failed to generate performance report' }, { status: 500 })
  }
}
