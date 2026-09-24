import { NextResponse } from 'next/server'
import connectToDatabase from '@/lib/mongodb'
import Employee from '@/models/Employee'
import { getAuthUser, hashPassword } from '@/lib/auth'

export async function GET(req: Request) {
  try {
    const user = await getAuthUser(req)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    await connectToDatabase()

    if (user.role === 'Director') {
      const employees = await Employee.find().select('-passwordHash').sort({ firstName: 1 })
      return NextResponse.json(employees)
    }

    if (user.role === 'Project Head') {
      const allowedIds = user.assignedEmployees || []
      const employees = await Employee.find({
        $or: [
          { _id: { $in: allowedIds } },
          { _id: user._id }
        ]
      }).select('-passwordHash').sort({ firstName: 1 })
      return NextResponse.json(employees)
    }

    // Employee role: return self only
    const self = await Employee.find({ _id: user._id }).select('-passwordHash')
    return NextResponse.json(self)
  } catch (error: any) {
    console.error('Employees GET API error:', error)
    return NextResponse.json({ error: 'Failed to fetch employees' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const user = await getAuthUser(req)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (user.role !== 'Director') {
      return NextResponse.json({ error: 'Forbidden: Only Director can add employees' }, { status: 403 })
    }

    await connectToDatabase()
    const body = await req.json()
    const { firstName, lastName, email, phone, role, status, password, assignedProjects, assignedEmployees } = body

    if (!firstName || !lastName || !email || !password) {
      return NextResponse.json({ error: 'First Name, Last Name, Email, and Password are required' }, { status: 400 })
    }

    const cleanEmail = email.toLowerCase().trim()
    const existing = await Employee.findOne({ email: cleanEmail })
    if (existing) {
      return NextResponse.json({ error: 'An employee with this email already exists' }, { status: 400 })
    }

    const passwordHash = await hashPassword(password)

    const newEmp = await Employee.create({
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: cleanEmail,
      phone: phone ? phone.trim() : '',
      role: role || 'Employee',
      status: status || 'Active',
      passwordHash,
      assignedProjects: assignedProjects || [],
      assignedEmployees: assignedEmployees || []
    })

    const result = newEmp.toObject()
    delete (result as any).passwordHash

    return NextResponse.json(result, { status: 201 })
  } catch (error: any) {
    console.error('Employees POST API error:', error)
    return NextResponse.json({ error: 'Failed to create employee' }, { status: 500 })
  }
}
