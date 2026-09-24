import { NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  try {
    const user = await getAuthUser(req)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    return NextResponse.json({
      user: {
        id: user._id.toString(),
        _id: user._id.toString(),
        firstName: user.firstName,
        lastName: user.lastName,
        name: `${user.firstName} ${user.lastName}`,
        email: user.email,
        role: user.role,
        status: user.status,
        phone: user.phone,
        assignedProjects: user.assignedProjects || [],
        assignedEmployees: user.assignedEmployees || []
      }
    })
  } catch (error: any) {
    console.error('Auth Me API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
