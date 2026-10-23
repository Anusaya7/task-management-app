import { NextResponse } from 'next/server'
import mongoose from 'mongoose'
import connectToDatabase from '@/lib/mongodb'
import Employee from '@/models/Employee'
import { hashPassword } from '@/lib/auth'

const SETUP_LOCK_ID = 'initial-director-account'
const getSetupLockCollection = () =>
  mongoose.connection.collection<{ _id: string; createdAt?: Date }>('setupLocks')

export async function GET() {
  try {
    await connectToDatabase()
    const [employeeCount, setupLock] = await Promise.all([
      Employee.countDocuments(),
      getSetupLockCollection().findOne({ _id: SETUP_LOCK_ID })
    ])

    const available = employeeCount === 0 && !setupLock
    return NextResponse.json({
      available,
      demoAccountsAvailable: available && process.env.NODE_ENV === 'development'
    })
  } catch (error) {
    console.error('Director setup status check failed:', error)
    return NextResponse.json({ error: 'Unable to check account setup status.' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  let setupLockAcquired = false

  try {
    await connectToDatabase()
    const body = await req.json()
    const createDemoAccounts = body.mode === 'demo'
    if (createDemoAccounts && process.env.NODE_ENV !== 'development') {
      return NextResponse.json({ error: 'Demo accounts are only available in local development.' }, { status: 403 })
    }
    const firstName = typeof body.firstName === 'string' ? body.firstName.trim() : ''
    const lastName = typeof body.lastName === 'string' ? body.lastName.trim() : ''
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
    const password = typeof body.password === 'string' ? body.password : ''
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

    if (!createDemoAccounts && (!firstName || !emailPattern.test(email) || password.length < 8)) {
      return NextResponse.json(
        { error: 'Enter your first name, a valid email, and a password of at least 8 characters.' },
        { status: 400 }
      )
    }

    try {
      await getSetupLockCollection().insertOne({
        _id: SETUP_LOCK_ID,
        createdAt: new Date()
      })
      setupLockAcquired = true
    } catch (error) {
      if ((error as { code?: number }).code === 11000) {
        return NextResponse.json({ error: 'Initial Director account setup has already been completed.' }, { status: 409 })
      }
      throw error
    }

    if (await Employee.exists({})) {
      await getSetupLockCollection().deleteOne({ _id: SETUP_LOCK_ID })
      setupLockAcquired = false
      return NextResponse.json({ error: 'Accounts already exist. Ask the Director to create your account.' }, { status: 409 })
    }

    if (createDemoAccounts) {
      const passwordHash = await hashPassword('password')
      await Employee.insertMany([
        { firstName: 'Director', lastName: 'Account', email: 'director@company.com', phone: '', passwordHash, role: 'Director', status: 'Active' },
        { firstName: 'Project', lastName: 'Head', email: 'projecthead@company.com', phone: '', passwordHash, role: 'Project Head', status: 'Active' },
        { firstName: 'Demo', lastName: 'Employee', email: 'employee@company.com', phone: '', passwordHash, role: 'Employee', status: 'Active' }
      ])
    } else {
      const passwordHash = await hashPassword(password)
      await Employee.create({
        firstName,
        lastName,
        email,
        phone: '',
        passwordHash,
        role: 'Director',
        status: 'Active'
      })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    if (setupLockAcquired) {
      await getSetupLockCollection().deleteOne({ _id: SETUP_LOCK_ID })
    }
    if (error && typeof error === 'object' && 'code' in error && error.code === 11000) {
      return NextResponse.json({ error: 'An account already uses this email address.' }, { status: 409 })
    }
    console.error('Initial Director account setup failed:', error)
    return NextResponse.json({ error: 'Unable to create the Director account.' }, { status: 500 })
  }
}
