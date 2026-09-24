import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { cookies } from 'next/headers'
import connectToDatabase from './mongodb'
import Employee, { IEmployee } from '@/models/Employee'

const JWT_SECRET = process.env.JWT_SECRET || 'taskmanager_phase1_super_secret_key_2026'

export async function hashPassword(password: string): Promise<string> {
  const salt = await bcrypt.genSalt(10)
  return bcrypt.hash(password, salt)
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash)
}

export function signToken(payload: { id: string; email: string; role: string; name: string }): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' })
}

export function verifyToken(token: string): any {
  try {
    return jwt.verify(token, JWT_SECRET)
  } catch {
    return null
  }
}

export async function getAuthUser(req?: Request): Promise<IEmployee | null> {
  let token: string | undefined

  // Check header first
  if (req) {
    const authHeader = req.headers.get('authorization') || req.headers.get('Authorization')
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7)
    }
  }

  // Fallback to cookie
  if (!token) {
    try {
      const cookieStore = cookies()
      token = cookieStore.get('auth_token')?.value
    } catch {
      // Cookies not accessible in some environments
    }
  }

  if (!token) return null

  const decoded = verifyToken(token)
  if (!decoded || !decoded.id) return null

  await connectToDatabase()

  const user = await Employee.findById(decoded.id)
  if (!user || user.status === 'Inactive') return null

  return user
}

// Return date string in Asia/Kolkata timezone (YYYY-MM-DD)
export function getTodayKolkata(): string {
  const options: Intl.DateTimeFormatOptions = {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }
  const formatter = new Intl.DateTimeFormat('en-CA', options)
  return formatter.format(new Date()) // Returns YYYY-MM-DD
}
