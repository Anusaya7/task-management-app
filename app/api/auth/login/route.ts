import { NextResponse } from 'next/server'
import connectToDatabase from '@/lib/mongodb'
import Employee from '@/models/Employee'
import { comparePassword, signToken } from '@/lib/auth'
import { seedDatabase } from '@/lib/seed'

export async function POST(req: Request) {
  try {
    await connectToDatabase()
    const { email, password } = await req.json()

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 })
    }

    // Auto seed database if no employees exist yet
    const count = await Employee.countDocuments()
    if (count === 0) {
      await seedDatabase()
    }

    const cleanEmail = email.toLowerCase().trim()
    const user = await Employee.findOne({ email: cleanEmail })

    if (!user) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
    }

    if (user.status === 'Inactive') {
      return NextResponse.json({ error: 'Account is inactive. Please contact Director.' }, { status: 403 })
    }

    const isValid = await comparePassword(password, user.passwordHash)
    if (!isValid) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
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
        status: user.status,
        phone: user.phone
      }
    })

    response.cookies.set('auth_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 // 7 days
    })

    return response
  } catch (error: any) {
    console.error('Login API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
