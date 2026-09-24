import { NextResponse } from 'next/server'
import connectToDatabase from '@/lib/mongodb'
import Project from '@/models/Project'
import { getAuthUser, getTodayKolkata } from '@/lib/auth'

export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    const user = await getAuthUser(req)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    await connectToDatabase()
    const project = await Project.findById(params.id)
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    return NextResponse.json(project)
  } catch (error: any) {
    console.error('Project GET by ID error:', error)
    return NextResponse.json({ error: 'Failed to fetch project' }, { status: 500 })
  }
}

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  try {
    const user = await getAuthUser(req)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (user.role !== 'Director') {
      return NextResponse.json({ error: 'Forbidden: Only Director can edit projects' }, { status: 403 })
    }

    await connectToDatabase()
    const body = await req.json()
    const project = await Project.findById(params.id)
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    if (body.projectName) project.projectName = body.projectName.trim()
    if (body.projectNumber) project.projectNumber = body.projectNumber.trim()
    if (body.location !== undefined) project.location = body.location.trim()
    if (body.description) project.description = body.description.trim()
    if (body.contactDetails !== undefined) project.contactDetails = body.contactDetails.trim()
    if (body.status) project.status = body.status

    if (body.newRemark) {
      const today = getTodayKolkata()
      project.projectRemarks.push({
        date: today,
        remark: body.newRemark.trim(),
        createdBy: user._id.toString()
      })
    }

    project.updatedAt = new Date()
    await project.save()

    return NextResponse.json(project)
  } catch (error: any) {
    console.error('Project PUT API error:', error)
    return NextResponse.json({ error: 'Failed to update project' }, { status: 500 })
  }
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  try {
    const user = await getAuthUser(req)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (user.role !== 'Director') {
      return NextResponse.json({ error: 'Forbidden: Only Director can delete projects' }, { status: 403 })
    }

    await connectToDatabase()
    await Project.findByIdAndDelete(params.id)

    return NextResponse.json({ success: true, message: 'Project deleted successfully' })
  } catch (error: any) {
    console.error('Project DELETE API error:', error)
    return NextResponse.json({ error: 'Failed to delete project' }, { status: 500 })
  }
}
