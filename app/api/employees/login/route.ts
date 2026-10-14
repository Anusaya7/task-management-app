import { NextRequest, NextResponse } from 'next/server'
import dbConnect from '../../../../lib/mongodb'
import Employee from '../../../../models/Employee'
import { comparePassword, ensureDirectorAccountsActive, signToken } from '../../../../lib/auth'
import { seedDatabase } from '../../../../lib/seed'
import { canAccountLogin, isDirectorRole, isInactiveEmployee, normalizeEmployeeStatus } from '../../../../lib/employeeStatus'

export async function POST(request: NextRequest) {
  try {
    await dbConnect()

    // Auto seed database if no employees exist yet
    try {
      const count = await Employee.countDocuments()
      if (count === 0) {
        await seedDatabase()
      }
    } catch (seedErr) {
      console.warn('Auto-seed check skipped or failed:', seedErr)
    }

    try {
      await ensureDirectorAccountsActive()
    } catch (directorFixErr) {
      console.warn('Director account reactivation skipped or failed:', directorFixErr)
    }

    const body = await request.json()
    const email = (body.email || body.username || '').toLowerCase().trim()
    const password = body.password

    if (!password || !email) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 })
    }

    // Find employee by email or username
    const user = await Employee.findOne({
      $or: [{ email }, { username: email }]
    })

    if (!user) {
      return NextResponse.json({ error: 'Invalid email or password.' }, { status: 401 })
    }

    let isValid = false
    if (user.passwordHash) {
      isValid = await comparePassword(password, user.passwordHash)
    }
    if (!isValid && (user as any).password) {
      isValid = (password === (user as any).password)
    }

    if (!isValid) {
      return NextResponse.json({ error: 'Invalid email or password.' }, { status: 401 })
    }

    if (!canAccountLogin(user.role, user.status)) {
      return NextResponse.json({ error: 'Account is inactive. Please contact Director.' }, { status: 403 })
    }

    if (isDirectorRole(user.role) && isInactiveEmployee(user.status)) {
      user.status = 'Active'
      await user.save()
    }

    const payload = {
      id: user._id.toString(),
      email: user.email,
      role: user.role,
      name: `${user.firstName} ${user.lastName}`
    }

    const token = signToken(payload)

    const userObj = user.toObject()
    const normalizedUser = {
      ...userObj,
      id: userObj._id.toString(),
      _id: userObj._id.toString(),
      name: `${user.firstName} ${user.lastName}`,
      status: normalizeEmployeeStatus(user.status),
      password: undefined,
      passwordHash: undefined
    }

    const response = NextResponse.json({
      success: true,
      token,
      user: normalizedUser,
      ...normalizedUser
    })

    response.cookies.set('auth_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60
    })

    return response
  } catch (error: any) {
    console.error('Employees login API error:', error)
    return NextResponse.json({ error: 'Login service is temporarily unavailable.' }, { status: 500 })
  }
}
