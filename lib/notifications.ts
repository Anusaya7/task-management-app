import connectToDatabase from './mongodb'
import Notification from '@/models/Notification'
import Employee from '@/models/Employee'
import Project from '@/models/Project'

interface CreateNotificationParams {
  recipientUserId?: string
  recipientRoles?: Array<'Director' | 'Project Head' | 'Employee'>
  projectId?: string
  employeeId?: string
  type: string
  title: string
  message: string
  taskId?: string
  relatedUserId?: string
  relatedUserName?: string
  previousWorkDone?: number
  newWorkDone?: number
}

export async function sendNotifications(params: CreateNotificationParams) {
  try {
    await connectToDatabase()
    const recipientUserIds = new Set<string>()

    if (params.recipientUserId) {
      recipientUserIds.add(params.recipientUserId)
    }

    if (params.recipientRoles && params.recipientRoles.length > 0) {
      // Find Directors if requested
      if (params.recipientRoles.includes('Director')) {
        const directors = await Employee.find({ role: 'Director', status: 'Active' }).select('_id')
        directors.forEach(d => recipientUserIds.add(d._id.toString()))
      }

      // Find Project Heads responsible for this project or employee if requested
      if (params.recipientRoles.includes('Project Head')) {
        let phQuery: any = { role: 'Project Head', status: 'Active' }
        const phs = await Employee.find(phQuery)

        phs.forEach(ph => {
          let isResponsible = false

          if (params.projectId && ph.assignedProjects && ph.assignedProjects.includes(params.projectId)) {
            isResponsible = true
          }
          if (params.employeeId && ph.assignedEmployees && ph.assignedEmployees.includes(params.employeeId)) {
            isResponsible = true
          }
          // If no specific project/employee specified, notify all active PHs
          if (!params.projectId && !params.employeeId) {
            isResponsible = true
          }

          if (isResponsible) {
            recipientUserIds.add(ph._id.toString())
          }
        })
      }
    }

    // Exclude sender from receiving their own notification if relevant
    if (params.relatedUserId) {
      recipientUserIds.delete(params.relatedUserId)
    }

    const notificationsToCreate = Array.from(recipientUserIds).map(userId => ({
      recipientUserId: userId,
      type: params.type,
      title: params.title,
      message: params.message,
      taskId: params.taskId,
      projectId: params.projectId,
      relatedUserId: params.relatedUserId,
      relatedUserName: params.relatedUserName,
      previousWorkDone: params.previousWorkDone,
      newWorkDone: params.newWorkDone,
      isRead: false
    }))

    if (notificationsToCreate.length > 0) {
      await Notification.insertMany(notificationsToCreate)
    }
  } catch (error) {
    console.error('Failed to send notification:', error)
  }
}
