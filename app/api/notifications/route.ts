import { NextResponse } from 'next/server'
import connectToDatabase from '@/lib/mongodb'
import Notification from '@/models/Notification'
import { getAuthUser } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  try {
    const user = await getAuthUser(req)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    await connectToDatabase()

    const notifications = await Notification.find({ recipientUserId: user._id.toString() })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean()

    const unreadCount = await Notification.countDocuments({
      recipientUserId: user._id.toString(),
      isRead: false
    })

    return NextResponse.json({ notifications, unreadCount })
  } catch (error: any) {
    console.error('Notifications GET API error:', error)
    return NextResponse.json({ error: 'Failed to fetch notifications' }, { status: 500 })
  }
}

export async function PUT(req: Request) {
  try {
    const user = await getAuthUser(req)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    await connectToDatabase()
    const { notificationId, markAllRead } = await req.json()

    if (markAllRead) {
      await Notification.updateMany(
        { recipientUserId: user._id.toString(), isRead: false },
        { $set: { isRead: true } }
      )
      return NextResponse.json({ success: true, message: 'All notifications marked as read' })
    }

    if (notificationId) {
      await Notification.updateOne(
        { _id: notificationId, recipientUserId: user._id.toString() },
        { $set: { isRead: true } }
      )
      return NextResponse.json({ success: true, message: 'Notification marked as read' })
    }

    return NextResponse.json({ error: 'notificationId or markAllRead required' }, { status: 400 })
  } catch (error: any) {
    console.error('Notifications PUT API error:', error)
    return NextResponse.json({ error: 'Failed to update notification' }, { status: 500 })
  }
}
