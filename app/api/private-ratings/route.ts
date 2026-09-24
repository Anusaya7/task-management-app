import { NextResponse } from 'next/server'
import connectToDatabase from '@/lib/mongodb'
import PrivateRating from '@/models/PrivateRating'
import { getAuthUser } from '@/lib/auth'

export async function GET(req: Request) {
  try {
    const user = await getAuthUser(req)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // STRICT PERMISSION CHECK: Director only!
    if (user.role !== 'Director') {
      return NextResponse.json({ error: 'Forbidden: Private ratings are accessible to Director only' }, { status: 403 })
    }

    await connectToDatabase()
    const ratings = await PrivateRating.find()
    return NextResponse.json(ratings)
  } catch (error: any) {
    console.error('Private Ratings GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch private ratings' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const user = await getAuthUser(req)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (user.role !== 'Director') {
      return NextResponse.json({ error: 'Forbidden: Only Director can set private ratings' }, { status: 403 })
    }

    await connectToDatabase()
    const { taskId, employeeId, rating, privateComment } = await req.json()

    if (!taskId || !employeeId || !rating) {
      return NextResponse.json({ error: 'Task ID, Employee ID, and Rating (1-5) are required' }, { status: 400 })
    }

    const numRating = Number(rating)
    if (numRating < 1 || numRating > 5) {
      return NextResponse.json({ error: 'Rating must be between 1 and 5' }, { status: 400 })
    }

    let existing = await PrivateRating.findOne({ taskId, employeeId })
    if (existing) {
      existing.rating = numRating
      if (privateComment !== undefined) existing.privateComment = privateComment
      await existing.save()
      return NextResponse.json(existing)
    }

    const newRating = await PrivateRating.create({
      taskId,
      employeeId,
      directorId: user._id.toString(),
      rating: numRating,
      privateComment: privateComment || ''
    })

    return NextResponse.json(newRating, { status: 201 })
  } catch (error: any) {
    console.error('Private Rating POST error:', error)
    return NextResponse.json({ error: 'Failed to save private rating' }, { status: 500 })
  }
}
