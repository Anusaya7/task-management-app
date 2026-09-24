import { NextResponse } from 'next/server'
import connectToDatabase from '@/lib/mongodb'
import DailyEntry from '@/models/DailyEntry'
import Task from '@/models/Task'
import { getAuthUser, getTodayKolkata } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  try {
    const user = await getAuthUser(req)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    await connectToDatabase()
    const todayDate = getTodayKolkata()

    if (user.role === 'Employee') {
      const todayEntries = await DailyEntry.find({
        employeeId: user._id.toString(),
        date: todayDate
      }).lean()

      const allocatedHours = todayEntries.reduce((sum, e) => sum + (e.hours || 0), 0)
      const freeHours = Math.max(0, 8 - allocatedHours)
      const completedCount = todayEntries.filter(e => e.status === 'Completed').length

      const totalAssignedTasks = await Task.countDocuments({ assignedEmployeeIds: user._id.toString() })
      const pendingTasks = await Task.countDocuments({
        assignedEmployeeIds: user._id.toString(),
        status: { $in: ['Pending', 'In Progress', 'Revision Required'] }
      })

      return NextResponse.json({
        totalWorkingHours: 8,
        allocatedHours,
        freeHours,
        tasksAddedToday: todayEntries.length,
        completedToday: completedCount,
        totalAssignedTasks,
        pendingTasks,
        date: todayDate
      })
    }

    // Directors / Project Heads summary
    const todayEntriesAll = await DailyEntry.find({ date: todayDate }).lean()
    const totalAllocatedAll = todayEntriesAll.reduce((sum, e) => sum + (e.hours || 0), 0)

    return NextResponse.json({
      totalWorkingHours: 8,
      allocatedHours: totalAllocatedAll,
      totalSubmittedEntriesToday: todayEntriesAll.length,
      date: todayDate
    })
  } catch (error: any) {
    console.error('Dashboard summary API error:', error)
    return NextResponse.json({ error: 'Failed to fetch dashboard summary' }, { status: 500 })
  }
}
