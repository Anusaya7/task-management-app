import { NextResponse } from 'next/server'
import connectToDatabase from '@/lib/mongodb'
import Employee from '@/models/Employee'
import { comparePassword, ensureDirectorAccountsActive, signToken } from '@/lib/auth'
import { canAccountLogin, isDirectorRole, isInactiveEmployee, normalizeEmployeeStatus } from '@/lib/employeeStatus'

export async function POST(req: Request) {
  try {
    await connectToDatabase()
    const { email, password } = await req.json()

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 })
    }

    try {
      await ensureDirectorAccountsActive()
    } catch (directorFixErr) {
      console.warn('Director account reactivation skipped or failed:', directorFixErr)
    }

    const cleanEmail = email.toLowerCase().trim()
    const user = await Employee.findOne({ email: cleanEmail })

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

    const response = NextResponse.json({
      success: true,
      token,
      user: {
        id: user._id.toString(),
        _id: user._id.toString(),
        firstName: user.firstName,
        lastName: user.lastName,
        name: `${user.firstName} ${user.lastName}`,
        email: user.email,
        role: user.role,
        status: normalizeEmployeeStatus(user.status),
        phone: user.phone
      }
    })

    response.cookies.set('auth_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60 // 7 days
    })

    return response
  } catch (error: any) {
    console.error('Login API error:', error)
    return NextResponse.json({ error: 'Login service is temporarily unavailable.' }, { status: 500 })
  }
}
