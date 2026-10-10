import { NextResponse } from 'next/server'
import connectToDatabase from '@/lib/mongodb'
import Project from '@/models/Project'
import Task from '@/models/Task'
import Employee from '@/models/Employee'
import { getAuthUser, getTodayKolkata } from '@/lib/auth'
import { isOngoingProjectStatus, persistProjectStatus, serializeProject } from '@/lib/projectStatus'
import { ensureProjectCodes } from '@/lib/hierarchyCodes'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  try {
    const user = await getAuthUser(req)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    await connectToDatabase()
    await ensureProjectCodes()

    if (user.role === 'Director') {
      const projects = await Project.find().sort({ updatedAt: -1 })
      return NextResponse.json(projects.map(serializeProject))
    }

    if (user.role === 'Project Head') {
      const allowedIds = user.assignedProjects || []
      const projects = await Project.find({ _id: { $in: allowedIds } }).sort({ updatedAt: -1 })
      return NextResponse.json(projects.map(serializeProject))
    }

    // Employee role: find projects linked to tasks assigned to this employee or directly assigned to employee
    const userTasks = await Task.find({ assignedEmployeeIds: user._id.toString() }).select('projectId')
    const taskProjectIds = userTasks.map(t => t.projectId)
    const directProjectIds = user.assignedProjects || []
    const projectIds = Array.from(new Set([...taskProjectIds, ...directProjectIds].filter(Boolean)))
    const projects = await Project.find({ _id: { $in: projectIds } }).sort({ updatedAt: -1 })

    return NextResponse.json(
      projects
        .filter(project => isOngoingProjectStatus(project.status))
        .map(serializeProject)
    )
  } catch (error: any) {
    console.error('Projects GET API error:', error)
    return NextResponse.json({ error: 'Failed to fetch projects' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const user = await getAuthUser(req)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Director & Project Head can create projects
    if (user.role !== 'Director' && user.role !== 'Project Head') {
      return NextResponse.json({ error: 'Forbidden: Only Director or Project Head can create projects' }, { status: 403 })
    }

    await connectToDatabase()
    const body = await req.json()
    const { projectName, projectNumber, location, description, contactDetails, status, projectRemarks } = body

    if (!projectName || !projectNumber || !description) {
      return NextResponse.json({ error: 'Project Name, Project Number, and Description are required' }, { status: 400 })
    }

    const today = getTodayKolkata()
    const remarks = (Array.isArray(projectRemarks) ? projectRemarks : [])
      .filter((item: any) => item && String(item.remark || '').trim())
      .map((item: any) => ({
        date: item.date || today,
        remark: String(item.remark).trim(),
        createdBy: item.createdBy || user._id.toString()
      }))
    if (remarks.length === 0 && body.initialRemark) {
      remarks.push({ date: today, remark: String(body.initialRemark).trim(), createdBy: user._id.toString() })
    }

    const newProject = await Project.create({
      projectName: projectName.trim(),
      projectNumber: projectNumber.trim(),
      location: location ? location.trim() : '',
      description: description.trim(),
      contactDetails: contactDetails ? contactDetails.trim() : '',
      status: persistProjectStatus(status),
      projectRemarks: remarks
    })

    // If Project Head created the project, add project ID to Project Head's assignedProjects scope
    if (user.role === 'Project Head') {
      const pId = newProject._id.toString()
      await Employee.findByIdAndUpdate(user._id, {
        $addToSet: { assignedProjects: pId }
      })
    }

    await ensureProjectCodes()
    const savedProject = (await Project.findById(newProject._id)) || newProject
    return NextResponse.json(serializeProject(savedProject), { status: 201 })
  } catch (error: any) {
    console.error('Projects POST API error:', error)
    return NextResponse.json({ error: 'Failed to create project' }, { status: 500 })
  }
}
