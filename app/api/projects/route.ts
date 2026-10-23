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

    if (user.role !== 'Director') {
      return NextResponse.json({ error: 'Forbidden: Only the Director can create projects' }, { status: 403 })
    }

    await connectToDatabase()
    const body = await req.json()
    const { projectName, projectNumber, location, description, startDate, contactDetails, status, projectRemarks } = body
    const normalizedProjectNumber = typeof projectNumber === 'string' && projectNumber.trim()
      ? projectNumber.trim()
      : `PRJ-${Date.now()}`

    if (!projectName || !location || !description) {
      return NextResponse.json({ error: 'Project Name, Location, and Description are required' }, { status: 400 })
    }

    // Project numbers must be unique so tasks never mix between projects.
    const duplicateNumber = await Project.findOne({ projectNumber: normalizedProjectNumber }).select('_id')
    if (duplicateNumber) {
      return NextResponse.json({ error: `Project Number '${normalizedProjectNumber}' is already used by another project. Please choose a unique number.` }, { status: 409 })
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
      projectNumber: normalizedProjectNumber,
      location: location ? location.trim() : '',
      description: description.trim(),
      startDate: typeof startDate === 'string' ? startDate.trim() : '',
      contactDetails: contactDetails ? contactDetails.trim() : '',
      status: persistProjectStatus(status),
      projectRemarks: remarks
    })

    await ensureProjectCodes()
    const savedProject = (await Project.findById(newProject._id)) || newProject
    return NextResponse.json(serializeProject(savedProject), { status: 201 })
  } catch (error: any) {
    console.error('Projects POST API error:', error)
    return NextResponse.json({ error: 'Failed to create project' }, { status: 500 })
  }
}
