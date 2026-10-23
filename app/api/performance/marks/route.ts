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
      query.projectId = { $in: ['all', ...(user.assignedProjects || [])] }
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
    if (projectId) {
      if (user.role === 'Project Head' &&
          projectId !== 'all' &&
          !(user.assignedProjects || []).includes(projectId)) {
        return NextResponse.json({ error: 'Project is outside your assigned scope' }, { status: 403 })
      }
      query.projectId = projectId
    }

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
    if (!['Director', 'Project Head', 'Employee'].includes(user.role)) {
      return NextResponse.json({ error: 'You are not allowed to submit weekly performance marks' }, { status: 403 })
    }

    await connectToDatabase()
    const body = await req.json()
    const employeeId = typeof body.employeeId === 'string' ? body.employeeId : ''
    const projectId = typeof body.projectId === 'string' ? body.projectId : ''
    const periodStart = body.periodStart
    const rating = Number(body.rating)
    const comment = typeof body.comment === 'string' ? body.comment.trim() : ''

    const isOverallRating = projectId === 'all'
    if (!mongoose.Types.ObjectId.isValid(employeeId) ||
        (!isOverallRating && !mongoose.Types.ObjectId.isValid(projectId)) ||
        !validDate(periodStart)) {
      return NextResponse.json({ error: 'A valid employee, project, and week start date are required' }, { status: 400 })
    }
    const weekStart = new Date(`${periodStart}T00:00:00.000Z`)
    if (weekStart.getUTCDay() !== 1) {
      return NextResponse.json({ error: 'Choose a Monday as the week start date' }, { status: 400 })
    }
    if (!Number.isInteger(rating) || rating < 1 || rating > 10) {
      return NextResponse.json({ error: 'Performance rating must be between 1 and 10' }, { status: 400 })
    }

    if (user.role === 'Employee' && employeeId !== user._id.toString()) {
      return NextResponse.json({ error: 'You can only submit your own performance mark' }, { status: 403 })
    }
    if (user.role === 'Project Head' && !(user.assignedEmployees || []).includes(employeeId)) {
      return NextResponse.json({ error: 'Employee is outside your assigned scope' }, { status: 403 })
    }

    const employee = await Employee.findOne({ _id: employeeId, role: 'Employee' }).select('_id')
    if (!employee) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 })
    }
    if (!isOverallRating) {
      if (!(await Project.exists({ _id: projectId }))) {
        return NextResponse.json({ error: 'Selected project does not exist' }, { status: 400 })
      }
      if (user.role === 'Project Head' && !(user.assignedProjects || []).includes(projectId)) {
        return NextResponse.json({ error: 'Project is outside your assigned scope' }, { status: 403 })
      }
      const employeeIsAssigned = await Employee.exists({ _id: employeeId, assignedProjects: projectId })
      const employeeHasProjectWork = Boolean(
        await Task.exists({ projectId, assignedEmployeeIds: employeeId }) ||
        await DailyEntry.exists({ projectId, employeeId })
      )
      if (!employeeIsAssigned && !employeeHasProjectWork) {
        return NextResponse.json({ error: 'Employee has no assigned work in the selected project' }, { status: 400 })
      }
    } else if (user.role === 'Employee') {
      const employeeHasWork = Boolean(
        await Task.exists({ assignedEmployeeIds: employeeId }) ||
        await DailyEntry.exists({ employeeId })
      )
      if (!employeeHasWork) {
        return NextResponse.json({ error: 'Log work before submitting a weekly self-rating' }, { status: 400 })
      }
    }

    const periodEnd = getWeekEnd(periodStart)
    const existingMark = await PerformanceMark.findOne({ employeeId, projectId, periodStart })
    const ratingField = user.role === 'Employee'
      ? 'selfRating'
      : user.role === 'Project Head'
        ? 'coordinatorRating'
        : 'rating'
    if (existingMark && existingMark.get(ratingField) !== undefined) {
      return NextResponse.json({ error: 'A weekly rating has already been submitted for this role' }, { status: 409 })
    }
    const ratingFields = user.role === 'Employee'
      ? { selfRating: rating, selfComment: comment, selfSubmittedAt: new Date() }
      : user.role === 'Project Head'
        ? { coordinatorRating: rating, coordinatorComment: comment, coordinatorId: user._id.toString() }
        : { rating, ratingScale: 10, comment, directorId: user._id.toString() }
    const mark = await PerformanceMark.findOneAndUpdate(
      { employeeId, projectId, periodStart },
      {
        $set: ratingFields,
        $setOnInsert: { employeeId, projectId, periodStart, periodEnd }
      },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
    )
    return NextResponse.json(mark)
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 11000) {
      return NextResponse.json({ error: 'A weekly rating already exists for this employee, project, and week' }, { status: 409 })
    }
    console.error('Performance marks POST error:', error)
    return NextResponse.json({ error: 'Failed to save weekly performance mark' }, { status: 500 })
  }
}
