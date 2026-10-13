import { NextResponse } from 'next/server'
import connectToDatabase from '@/lib/mongodb'
import Employee from '@/models/Employee'
import Attendance from '@/models/Attendance'
import Project from '@/models/Project'
import { getAuthUser, hashPassword, getTodayKolkata } from '@/lib/auth'

export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    const user = await getAuthUser(req)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    await connectToDatabase()
    const emp = await Employee.findById(params.id).select('-passwordHash')
    if (!emp) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 })
    }

    if (user.role === 'Employee' && params.id !== user._id.toString()) {
      return NextResponse.json({ error: 'Forbidden: You can only view your own profile' }, { status: 403 })
    }

    if (user.role === 'Project Head') {
      const allowed = user.assignedEmployees || []
      if (!allowed.includes(params.id) && params.id !== user._id.toString()) {
        return NextResponse.json({ error: 'Forbidden: Employee outside assigned scope' }, { status: 403 })
      }
    }

    return NextResponse.json(emp)
  } catch (error: any) {
    console.error('Employee GET by ID error:', error)
    return NextResponse.json({ error: 'Failed to fetch employee' }, { status: 500 })
  }
}

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  try {
    const user = await getAuthUser(req)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (user.role !== 'Director') {
      return NextResponse.json({ error: 'Forbidden: Only Director can edit employee details' }, { status: 403 })
    }

    await connectToDatabase()
    const body = await req.json()
    const emp = await Employee.findById(params.id)
    if (!emp) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 })
    }

    const removesAvailableDirector = emp.role === 'Director' &&
      (body.status === 'Inactive' || (body.role && body.role !== 'Director'))
    if (removesAvailableDirector) {
      if (body.status === 'Inactive' && emp._id.toString() === user._id.toString()) {
        return NextResponse.json({ error: 'You cannot deactivate your own Director account.' }, { status: 409 })
      }

      const remainingDirectors = await Employee.countDocuments({
        role: 'Director',
        status: { $ne: 'Inactive' },
        _id: { $ne: emp._id }
      })
      if (remainingDirectors === 0) {
        return NextResponse.json({ error: 'At least one available Director account must remain.' }, { status: 409 })
      }
    }

    if (body.firstName) emp.firstName = body.firstName.trim()
    if (body.lastName) emp.lastName = body.lastName.trim()
    if (body.phone !== undefined) emp.phone = body.phone.trim()
    if (body.role) emp.role = body.role
    if (body.role && body.role !== 'Project Head') {
      emp.assignedProjects = []
      emp.assignedEmployees = []
    }

    if (body.assignedProjects !== undefined) {
      if (emp.role !== 'Project Head' || !Array.isArray(body.assignedProjects)) {
        return NextResponse.json({ error: 'Project access can only be assigned to a Project Head.' }, { status: 400 })
      }
      const projectIds = body.assignedProjects.filter(
        (id: unknown): id is string => typeof id === 'string' && id.length > 0
      )
      if (projectIds.length !== body.assignedProjects.length) {
        return NextResponse.json({ error: 'Project IDs must be valid strings.' }, { status: 400 })
      }
      const uniqueProjectIds: string[] = Array.from(new Set<string>(projectIds))
      const existingProjects = await Project.countDocuments({ _id: { $in: uniqueProjectIds } })
      if (existingProjects !== uniqueProjectIds.length) {
        return NextResponse.json({ error: 'One or more selected projects no longer exist.' }, { status: 400 })
      }
      emp.assignedProjects = uniqueProjectIds
    }

    if (body.assignedEmployees !== undefined) {
      if (emp.role !== 'Project Head' || !Array.isArray(body.assignedEmployees)) {
        return NextResponse.json({ error: 'Employee access can only be assigned to a Project Head.' }, { status: 400 })
      }
      const employeeIds = body.assignedEmployees.filter(
        (id: unknown): id is string => typeof id === 'string' && id.length > 0
      )
      if (employeeIds.length !== body.assignedEmployees.length) {
        return NextResponse.json({ error: 'Employee IDs must be valid strings.' }, { status: 400 })
      }
      const uniqueEmployeeIds: string[] = Array.from(new Set<string>(employeeIds))
      const activeEmployees = await Employee.countDocuments({
        _id: { $in: uniqueEmployeeIds },
        role: 'Employee',
        status: 'Active'
      })
      if (activeEmployees !== uniqueEmployeeIds.length) {
        return NextResponse.json({ error: 'Project Heads can only be assigned existing active employees.' }, { status: 400 })
      }
      emp.assignedEmployees = uniqueEmployeeIds
    }

    if (body.status && body.status !== emp.status) {
      emp.status = body.status
      // Record attendance event if status changed to Absent
      if (body.status === 'Absent') {
        const today = getTodayKolkata()
        await Attendance.create({
          employeeId: emp._id.toString(),
          employeeName: `${emp.firstName} ${emp.lastName}`,
          date: today,
          status: 'Absent',
          markedBy: user._id.toString(),
          actionTaken: body.absenceAction || 'Carry Forward'
        })
      }
    }

    if (body.newPassword) {
      emp.passwordHash = await hashPassword(body.newPassword)
    }

    emp.updatedAt = new Date()
    await emp.save()

    const result = emp.toObject()
    delete (result as any).passwordHash

    return NextResponse.json(result)
  } catch (error: any) {
    console.error('Employee PUT API error:', error)
    return NextResponse.json({ error: 'Failed to update employee' }, { status: 500 })
  }
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  try {
    const user = await getAuthUser(req)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (user.role !== 'Director') {
      return NextResponse.json({ error: 'Forbidden: Only Director can delete employee' }, { status: 403 })
    }

    await connectToDatabase()
    // Soft delete by setting status to Inactive so historical records remain intact
    const emp = await Employee.findById(params.id)
    if (!emp) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 })
    }

    if (emp.role === 'Director') {
      if (emp._id.toString() === user._id.toString()) {
        return NextResponse.json({ error: 'You cannot deactivate your own Director account.' }, { status: 409 })
      }

      const remainingDirectors = await Employee.countDocuments({
        role: 'Director',
        status: { $ne: 'Inactive' },
        _id: { $ne: emp._id }
      })
      if (remainingDirectors === 0) {
        return NextResponse.json({ error: 'At least one available Director account must remain.' }, { status: 409 })
      }
    }

    emp.status = 'Inactive'
    await emp.save()

    return NextResponse.json({ success: true, message: 'Employee set to Inactive' })
  } catch (error: any) {
    console.error('Employee DELETE API error:', error)
    return NextResponse.json({ error: 'Failed to delete employee' }, { status: 500 })
  }
}
