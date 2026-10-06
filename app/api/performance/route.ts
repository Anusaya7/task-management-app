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

    const reqStartDate = searchParams.get('startDate')
    const reqEndDate = searchParams.get('endDate')

    const customStartStr = reqStartDate || monthStartStr
    const customEndStr = reqEndDate || today

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

      const ratings = await PrivateRating.find({ employeeId: empIdStr }).lean()
      const ratingByTaskId = new Map<string, number>()
      ratings.forEach(r => {
        const taskId = r.taskId ? String(r.taskId) : ''
        const storedRating = Number(r.rating)
        if (!taskId || taskId === 'OFFICE_WORK') return
        if (!Number.isFinite(storedRating) || storedRating < 1 || storedRating > 5) return
        ratingByTaskId.set(taskId, storedRating)
      })
      const getExactTaskRating = (taskId: string | undefined | null): number | null => {
        if (!taskId || taskId === 'OFFICE_WORK') return null
        const storedRating = ratingByTaskId.get(String(taskId))
        return typeof storedRating === 'number' && storedRating >= 1 && storedRating <= 5
          ? storedRating
          : null
      }
      let markingScore: number | null = null
      const employeeRatings = Array.from(ratingByTaskId.values())
      if (employeeRatings.length === 1) {
        markingScore = employeeRatings[0]
      } else if (employeeRatings.length > 1) {
        markingScore = Math.round((employeeRatings.reduce((acc, value) => acc + value, 0) / employeeRatings.length) * 10) / 10
      }

      // Calculate Weekly, Monthly, and Custom Range metrics from Daily Entries
      const dailyEntries = await DailyEntry.find({ employeeId: empIdStr }).lean()

      // Helper function for metric calculation
      const calcMetrics = (startDateStr: string, endDateStr: string) => {
        const effectiveEnd = endDateStr < today ? endDateStr : today
        const hoursByDate: Record<string, number> = {}
        const entriesByDate: Record<string, typeof dailyEntries> = {}

        for (const entry of dailyEntries) {
          if (entry.date >= startDateStr && entry.date <= effectiveEnd) {
            hoursByDate[entry.date] = (hoursByDate[entry.date] || 0) + (Number(entry.hours) || 0)
            if (!entriesByDate[entry.date]) entriesByDate[entry.date] = []
            entriesByDate[entry.date].push(entry)
          }
        }

        const workDates = Object.keys(entriesByDate).sort((a, b) => b.localeCompare(a))
        let totalWorkHours = 0
        let totalFreeHours = 0
        const dayWise: Array<{
          date: string
          tasks: string[]
          taskMarkings: Array<{ title: string; marking: number | null }>
          workHours: number
          freeHours: number
          marking: number | null
        }> = []
        const periodRatedTaskIds = new Set<string>()
        const periodRatings: number[] = []

        for (const dStr of workDates) {
          const dayHours = Math.round((hoursByDate[dStr] || 0) * 60) / 60
          const dayEntries = entriesByDate[dStr] || []
          const freeHours = Math.round(Math.max(0, 8 - dayHours) * 60) / 60
          totalWorkHours += dayHours
          totalFreeHours += freeHours

          const taskMarkings: Array<{ title: string; marking: number | null }> = []
          const seenTitles = new Set<string>()
          const seenTaskKeys = new Set<string>()
          for (const entry of dayEntries) {
            const title = (entry.taskTitle || '').trim()
            const taskId = entry.taskId ? String(entry.taskId) : ''
            const taskKey = taskId || `title:${title.toLowerCase()}`
            if (!title || seenTitles.has(title) || seenTaskKeys.has(taskKey)) continue
            seenTitles.add(title)
            seenTaskKeys.add(taskKey)
            const marking = getExactTaskRating(taskId)
            taskMarkings.push({ title, marking })
            if (taskId && taskId !== 'OFFICE_WORK' && !periodRatedTaskIds.has(taskId)) {
              periodRatedTaskIds.add(taskId)
              if (marking !== null) periodRatings.push(marking)
            }
          }

          const ratedValues = taskMarkings
            .map(item => item.marking)
            .filter((value): value is number => value !== null)
          const allTasksRated = taskMarkings.length > 0 && ratedValues.length === taskMarkings.length
          const sameRating = allTasksRated && ratedValues.every(value => value === ratedValues[0])
          const marking = taskMarkings.length === 1
            ? taskMarkings[0].marking
            : sameRating
              ? ratedValues[0]
              : null

          dayWise.push({
            date: dStr,
            tasks: taskMarkings.map(item => item.title),
            taskMarkings,
            workHours: dayHours,
            freeHours,
            marking
          })
        }

        const rangeEntries = dailyEntries.filter(e => e.date >= startDateStr && e.date <= effectiveEnd)
        const taskIds = new Set(
          rangeEntries
            .map(e => e.taskId)
            .filter((id): id is string => Boolean(id) && id !== 'OFFICE_WORK')
        )
        const officeTitles = new Set(
          rangeEntries
            .filter(e => e.taskId === 'OFFICE_WORK')
            .map(e => (e.taskTitle || '').trim().toLowerCase())
            .filter(Boolean)
        )
        const taskCount = taskIds.size + officeTitles.size

        return {
          workDone: taskCount,
          taskCount,
          workHours: Math.round(totalWorkHours * 60) / 60,
          freeHours: Math.round(totalFreeHours * 60) / 60,
          marking: periodRatings.length === 0
            ? null
            : periodRatings.length === 1
              ? periodRatings[0]
              : Math.round((periodRatings.reduce((sum, value) => sum + value, 0) / periodRatings.length) * 10) / 10,
          dayWise
        }
      }

      const weeklyMetrics = calcMetrics(weekStartStr, weekEndStr)
      const monthlyMetrics = calcMetrics(monthStartStr, monthEndStr)
      const customMetrics = calcMetrics(customStartStr, customEndStr)

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
        directorRating: markingScore ?? undefined,
        weekly: {
          workDone: weeklyMetrics.workDone,
          taskCount: weeklyMetrics.taskCount,
          workHours: weeklyMetrics.workHours,
          freeHours: weeklyMetrics.freeHours,
          marking: weeklyMetrics.marking,
          dayWise: weeklyMetrics.dayWise
        },
        monthly: {
          workDone: monthlyMetrics.workDone,
          taskCount: monthlyMetrics.taskCount,
          workHours: monthlyMetrics.workHours,
          freeHours: monthlyMetrics.freeHours,
          marking: monthlyMetrics.marking,
          dayWise: monthlyMetrics.dayWise
        },
        custom: {
          startDate: customStartStr,
          endDate: customEndStr,
          workDone: customMetrics.workDone,
          taskCount: customMetrics.taskCount,
          workHours: customMetrics.workHours,
          freeHours: customMetrics.freeHours,
          marking: customMetrics.marking,
          dayWise: customMetrics.dayWise
        }
      })
    }

    return NextResponse.json(performanceReport)
  } catch (error: any) {
    console.error('Performance GET error:', error)
    return NextResponse.json({ error: 'Failed to generate performance report' }, { status: 500 })
  }
}
