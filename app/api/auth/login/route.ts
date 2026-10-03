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
    try {
      const count = await Employee.countDocuments()
      if (count === 0) {
        await seedDatabase()
      }
    } catch (seedErr) {
      console.warn('Auto-seed check skipped or failed:', seedErr)
    }

    const cleanEmail = email.toLowerCase().trim()
    let user = await Employee.findOne({ email: cleanEmail })

    if (!user) {
      // If user is not found, attempt on-demand seed to ensure initial accounts exist in DB
      try {
        await seedDatabase()
        user = await Employee.findOne({ email: cleanEmail })
      } catch (seedErr) {
        console.warn('On-demand seed failed:', seedErr)
      }
    }

    if (!user) {
      return NextResponse.json({ error: 'Invalid email or password.' }, { status: 401 })
    }

    if (user.status === 'Inactive') {
      return NextResponse.json({ error: 'Account is inactive. Please contact Director.' }, { status: 403 })
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
      path: '/',
      maxAge: 7 * 24 * 60 * 60 // 7 days
    })

    return response
  } catch (error: any) {
    console.error('Login API error:', error)
    const errorMsg = error?.message || 'Internal server error'
    if (errorMsg.includes('ENOTFOUND') || errorMsg.includes('Mongo') || errorMsg.includes('connect')) {
      return NextResponse.json({
        error: process.env.VERCEL
          ? 'Database connection error. Please verify MONGODB_URI in Vercel Production Environment Variables.'
          : 'Database connection error. Please verify MONGODB_URI in .env.local.'
      }, { status: 500 })
    }
    return NextResponse.json({ error: errorMsg }, { status: 500 })
  }
}
