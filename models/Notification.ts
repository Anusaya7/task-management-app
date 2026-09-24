import mongoose, { Document, Schema } from 'mongoose'

export interface INotification extends Document {
  recipientUserId: string
  type: string
  title: string
  message: string
  taskId?: string
  projectId?: string
  relatedUserId?: string
  relatedUserName?: string
  previousWorkDone?: number
  newWorkDone?: number
  isRead: boolean
  createdAt: Date
}

const notificationSchema = new Schema<INotification>({
  recipientUserId: { type: String, required: true, index: true },
  type: { type: String, required: true },
  title: { type: String, required: true },
  message: { type: String, required: true },
  taskId: { type: String, index: true },
  projectId: { type: String, index: true },
  relatedUserId: { type: String },
  relatedUserName: { type: String },
  previousWorkDone: { type: Number },
  newWorkDone: { type: Number },
  isRead: { type: Boolean, default: false, index: true },
  createdAt: { type: Date, default: Date.now, index: true }
})

if (mongoose.models.Notification) {
  mongoose.deleteModel('Notification')
}

export default mongoose.model<INotification>('Notification', notificationSchema)
