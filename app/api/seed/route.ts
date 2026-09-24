import { NextResponse } from 'next/server'
import { seedDatabase } from '@/lib/seed'

export async function GET() {
  try {
    await seedDatabase()
    return NextResponse.json({ success: true, message: 'Database seeded successfully' })
  } catch (error: any) {
    console.error('Seed error:', error)
    return NextResponse.json({ error: 'Failed to seed database', details: error.message }, { status: 500 })
  }
}

export async function POST() {
  try {
    await seedDatabase()
    return NextResponse.json({ success: true, message: 'Database seeded successfully' })
  } catch (error: any) {
    console.error('Seed error:', error)
    return NextResponse.json({ error: 'Failed to seed database', details: error.message }, { status: 500 })
  }
}
