import { NextResponse } from 'next/server'
import connectToDatabase from '@/lib/mongodb'
import DailyEntry from '@/models/DailyEntry'
import { getAuthUser } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET(
  req: Request,
  { params }: { params: { id: string; attachmentId: string } }
) {
  try {
    const user = await getAuthUser(req)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    await connectToDatabase()
    const entry = await DailyEntry.findById(params.id)
    if (!entry) {
      return NextResponse.json({ error: 'Daily entry not found' }, { status: 404 })
    }

    if (user.role === 'Employee' && entry.employeeId !== user._id.toString()) {
      return NextResponse.json({ error: 'Forbidden: You can only access your own entries' }, { status: 403 })
    }

    if (user.role === 'Project Head') {
      const allowedEmployees = user.assignedEmployees || []
      const allowedProjects = user.assignedProjects || []
      const isAllowed =
        allowedEmployees.includes(entry.employeeId) ||
        entry.employeeId === user._id.toString() ||
        allowedProjects.includes(entry.projectId)
      if (!isAllowed) {
        return NextResponse.json({ error: 'Forbidden: Daily entry outside assigned scope' }, { status: 403 })
      }
    }

    const attachment = (entry.attachments || []).find(item => item.id === params.attachmentId)
    if (!attachment) {
      return NextResponse.json({ error: 'Attachment not found' }, { status: 404 })
    }

    return new NextResponse(new Uint8Array(Buffer.from(attachment.data, 'base64')), {
      headers: {
        'Content-Type': attachment.fileType,
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(attachment.fileName)}`,
        'Content-Length': String(attachment.fileSize),
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff'
      }
    })
  } catch (error) {
    console.error('DailyEntry attachment GET error:', error)
    return NextResponse.json({ error: 'Failed to download attachment' }, { status: 500 })
  }
}
