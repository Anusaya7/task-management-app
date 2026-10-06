import { NextResponse } from 'next/server'
import connectToDatabase from '@/lib/mongodb'
import Project from '@/models/Project'
import Task from '@/models/Task'
import DailyEntry from '@/models/DailyEntry'
import Flag from '@/models/Flag'
import Notification from '@/models/Notification'
import Reminder from '@/models/Reminder'
import TaskHistory from '@/models/TaskHistory'
import TaskAssignmentHistory from '@/models/TaskAssignmentHistory'
import PrivateRating from '@/models/PrivateRating'
import { getAuthUser, getTodayKolkata } from '@/lib/auth'
import { persistProjectStatus, serializeProject } from '@/lib/projectStatus'

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

    return NextResponse.json(serializeProject(project))
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

    if (user.role !== 'Director' && user.role !== 'Project Head') {
      return NextResponse.json({ error: 'Forbidden: Only Director or Project Head can edit projects' }, { status: 403 })
    }

    await connectToDatabase()
    const body = await req.json()
    const project = await Project.findById(params.id)
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    const previousProjectName = project.projectName
    if (body.projectName) project.projectName = body.projectName.trim()
    if (body.projectNumber) project.projectNumber = body.projectNumber.trim()
    if (body.location !== undefined) project.location = body.location.trim()
    if (body.description) project.description = body.description.trim()
    if (body.contactDetails !== undefined) project.contactDetails = body.contactDetails.trim()
    if (body.status) project.status = persistProjectStatus(body.status)
    if (Array.isArray(body.projectRemarks)) {
      project.projectRemarks = body.projectRemarks
        .filter((item: any) => item && String(item.remark || '').trim())
        .map((item: any) => ({
          ...(item._id ? { _id: item._id } : {}),
          date: item.date || getTodayKolkata(),
          remark: String(item.remark).trim(),
          createdBy: item.createdBy || user._id.toString()
        }))
      project.markModified('projectRemarks')
    }

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

    // Tasks, daily entries and flags store a copy of the project name.
    if (project.projectName !== previousProjectName) {
      const projectId = project._id.toString()
      const projectName = project.projectName
      await Promise.all([
        Task.updateMany({ projectId }, { $set: { projectName } }),
        DailyEntry.updateMany({ projectId }, { $set: { projectName } }),
        Flag.updateMany({ projectId }, { $set: { projectName } })
      ])
    }

    return NextResponse.json(serializeProject(project))
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
    const project = await Project.findByIdAndDelete(params.id)
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    // Remove everything employees could still see for this project.
    const projectId = project._id.toString()
    const projectTasks = await Task.find({ projectId }).select('_id')
    const taskIds = projectTasks.map(task => task._id.toString())

    await Promise.all([
      Task.deleteMany({ projectId }),
      DailyEntry.deleteMany({ projectId }),
      Flag.deleteMany({ $or: [{ projectId }, { taskId: { $in: taskIds } }] }),
      Notification.deleteMany({ $or: [{ projectId }, { taskId: { $in: taskIds } }] }),
      ...(taskIds.length > 0
        ? [
            Reminder.deleteMany({ taskId: { $in: taskIds } }),
            TaskHistory.deleteMany({ taskId: { $in: taskIds } }),
            TaskAssignmentHistory.deleteMany({ taskId: { $in: taskIds } }),
            PrivateRating.deleteMany({ taskId: { $in: taskIds } })
          ]
        : [])
    ])

    return NextResponse.json({ success: true, message: 'Project deleted successfully' })
  } catch (error: any) {
    console.error('Project DELETE API error:', error)
    return NextResponse.json({ error: 'Failed to delete project' }, { status: 500 })
  }
}
