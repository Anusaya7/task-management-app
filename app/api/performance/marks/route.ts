import { NextResponse } from 'next/server'
import mongoose from 'mongoose'
import connectToDatabase from '@/lib/mongodb'
import Employee from '@/models/Employee'
import DailyEntry from '@/models/DailyEntry'
import PerformanceMark from '@/models/PerformanceMark'
import Project from '@/models/Project'
import Task from '@/models/Task'
import { getAuthUser } from '@/lib/auth'

export const dynamic = 'force-dynamic'

const validDate = (value: unknown): value is string =>
  typeof value === 'string' &&
  /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  !Number.isNaN(new Date(`${value}T00:00:00.000Z`).getTime()) &&
  new Date(`${value}T00:00:00.000Z`).toISOString().startsWith(value)

const getWeekEnd = (start: string) => {
  const date = new Date(`${start}T00:00:00.000Z`)
  date.setUTCDate(date.getUTCDate() + 6)
  return date.toISOString().slice(0, 10)
}

export async function GET(req: Request) {
  try {
    const user = await getAuthUser(req)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!['Director', 'Project Head', 'Employee'].includes(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    await connectToDatabase()
    const { searchParams } = new URL(req.url)
    const query: Record<string, unknown> = {}

    if (user.role === 'Employee') {
      query.employeeId = user._id.toString()
    } else if (user.role === 'Project Head') {
      query.employeeId = { $in: user.assignedEmployees || [] }
    }

    const requestedEmployeeId = searchParams.get('employeeId')
    if (requestedEmployeeId) {
      if (user.role === 'Employee' && requestedEmployeeId !== user._id.toString()) {
        return NextResponse.json({ error: 'You can only view your own performance marks' }, { status: 403 })
      }
      if (user.role === 'Project Head' && !(user.assignedEmployees || []).includes(requestedEmployeeId)) {
        return NextResponse.json({ error: 'Employee is outside your assigned scope' }, { status: 403 })
      }
      query.employeeId = requestedEmployeeId
    }

    const periodStart = searchParams.get('periodStart')
    const projectId = searchParams.get('projectId')
    if (periodStart) {
      if (!validDate(periodStart)) {
        return NextResponse.json({ error: 'A valid week start date is required' }, { status: 400 })
      }
      query.periodStart = periodStart
    }
    if (projectId) query.projectId = projectId

    const marks = await PerformanceMark.find(query).sort({ periodStart: -1, updatedAt: -1 }).lean()
    return NextResponse.json(marks)
  } catch (error) {
    console.error('Performance marks GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch performance marks' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const user = await getAuthUser(req)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (user.role !== 'Director') {
      return NextResponse.json({ error: 'Only the Director can submit weekly performance marks' }, { status: 403 })
    }

    await connectToDatabase()
    const body = await req.json()
    const employeeId = typeof body.employeeId === 'string' ? body.employeeId : ''
    const projectId = typeof body.projectId === 'string' && body.projectId ? body.projectId : 'all'
    const periodStart = body.periodStart
    const rating = Number(body.rating)
    const comment = typeof body.comment === 'string' ? body.comment.trim() : ''

    if (!mongoose.Types.ObjectId.isValid(employeeId) || !validDate(periodStart)) {
      return NextResponse.json({ error: 'A valid employee and week start date are required' }, { status: 400 })
    }
    const weekStart = new Date(`${periodStart}T00:00:00.000Z`)
    if (weekStart.getUTCDay() !== 1) {
      return NextResponse.json({ error: 'Choose a Monday as the week start date' }, { status: 400 })
    }
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      return NextResponse.json({ error: 'Performance mark must be between 1 and 5' }, { status: 400 })
    }
    if (!comment) {
      return NextResponse.json({ error: 'Add a comment with the weekly performance mark' }, { status: 400 })
    }

    const employee = await Employee.findOne({ _id: employeeId, role: 'Employee' }).select('_id')
    if (!employee) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 })
    }
    if (projectId !== 'all') {
      if (!mongoose.Types.ObjectId.isValid(projectId) || !(await Project.exists({ _id: projectId }))) {
        return NextResponse.json({ error: 'Selected project does not exist' }, { status: 400 })
      }
      const employeeIsAssigned = await Employee.exists({ _id: employeeId, assignedProjects: projectId })
      const employeeHasProjectWork = Boolean(
        await Task.exists({ projectId, assignedEmployeeIds: employeeId }) ||
        await DailyEntry.exists({ projectId, employeeId })
      )
      if (!employeeIsAssigned && !employeeHasProjectWork) {
        return NextResponse.json({ error: 'Employee has no assigned work in the selected project' }, { status: 400 })
      }
    }

    const periodEnd = getWeekEnd(periodStart)
    const mark = await PerformanceMark.findOneAndUpdate(
      { employeeId, projectId, periodStart },
      {
        $set: {
          periodEnd,
          rating,
          comment,
          directorId: user._id.toString(),
          updatedAt: new Date()
        },
        $setOnInsert: { employeeId, projectId, periodStart, createdAt: new Date() }
      },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
    )
    return NextResponse.json(mark)
  } catch (error) {
    console.error('Performance marks POST error:', error)
    return NextResponse.json({ error: 'Failed to save weekly performance mark' }, { status: 500 })
  }
}
