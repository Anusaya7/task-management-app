import { NextRequest, NextResponse } from 'next/server'
import dbConnect from '../../../../../lib/mongodb'
import Project from '../../../../../models/Project'
import { getAuthUser } from '../../../../../lib/auth'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getAuthUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    await dbConnect()
    
    const { content } = await request.json()
    
    if (!content) {
      return NextResponse.json({ message: 'Comment content is required' }, { status: 400 })
    }
    
    // Validate MongoDB ObjectId format
    if (!params.id.match(/^[0-9a-fA-F]{24}$/)) {
      return NextResponse.json({ message: 'Invalid project ID format' }, { status: 400 })
    }
    
    const project = await Project.findById(params.id)
    if (!project) {
      return NextResponse.json({ message: 'Project not found' }, { status: 404 })
    }
    
    const newComment = {
      id: Date.now().toString(),
      userId: user._id.toString(),
      userName: `${user.firstName} ${user.lastName}`,
      userRole: user.role,
      content,
      timestamp: new Date(),
      isVisibleToEmployee: true
    }
    
    // Initialize comments array if it doesn't exist
    if (!(project as any).comments) {
      (project as any).comments = []
    }
    
    (project as any).comments.push(newComment)
    project.updatedAt = new Date()
    
    const savedProject = await project.save()
    
    // Normalize the response
    const projectObj = savedProject.toObject()
    const normalizedProject = {
      ...projectObj,
      id: projectObj._id
    }
    
    return NextResponse.json(normalizedProject, { status: 201 })
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 400 }
    )
  }
}
