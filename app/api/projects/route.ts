import { NextResponse } from 'next/server'
import connectToDatabase from '@/lib/mongodb'
import Project from '@/models/Project'
import Task from '@/models/Task'
import { getAuthUser, getTodayKolkata } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  try {
    const user = await getAuthUser(req)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    await connectToDatabase()

    if (user.role === 'Director') {
      const projects = await Project.find().sort({ updatedAt: -1 })
      return NextResponse.json(projects)
    }

    if (user.role === 'Project Head') {
      const allowedIds = user.assignedProjects || []
      const projects = await Project.find({ _id: { $in: allowedIds } }).sort({ updatedAt: -1 })
      return NextResponse.json(projects)
    }

    // Employee role: find projects linked to tasks assigned to this employee or directly assigned to employee
    const userTasks = await Task.find({ assignedEmployeeIds: user._id.toString() }).select('projectId')
    const taskProjectIds = userTasks.map(t => t.projectId)
    const directProjectIds = user.assignedProjects || []
    const projectIds = Array.from(new Set([...taskProjectIds, ...directProjectIds].filter(Boolean)))
    const projects = await Project.find({ _id: { $in: projectIds } }).sort({ updatedAt: -1 })

    return NextResponse.json(projects)
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

    // Only Director can create projects
    if (user.role !== 'Director') {
      return NextResponse.json({ error: 'Forbidden: Only Director can create projects' }, { status: 403 })
    }

    await connectToDatabase()
    const body = await req.json()
    const { projectName, projectNumber, location, description, contactDetails, status, projectRemarks } = body

    if (!projectName || !projectNumber || !description) {
      return NextResponse.json({ error: 'Project Name, Project Number, and Description are required' }, { status: 400 })
    }

    const today = getTodayKolkata()
    const remarks = Array.isArray(projectRemarks) ? projectRemarks : []
    if (remarks.length === 0 && body.initialRemark) {
      remarks.push({ date: today, remark: body.initialRemark, createdBy: user._id.toString() })
    }

    const newProject = await Project.create({
      projectName: projectName.trim(),
      projectNumber: projectNumber.trim(),
      location: location ? location.trim() : '',
      description: description.trim(),
      contactDetails: contactDetails ? contactDetails.trim() : '',
      status: status || 'Current',
      projectRemarks: remarks
    })

    return NextResponse.json(newProject, { status: 201 })
  } catch (error: any) {
    console.error('Projects POST API error:', error)
    return NextResponse.json({ error: 'Failed to create project' }, { status: 500 })
  }
}
