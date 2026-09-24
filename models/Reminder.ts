import mongoose, { Document, Schema } from 'mongoose'

export interface IReminder extends Document {
  taskId: string
  taskTitle?: string
  employeeId: string
  employeeName?: string
  reminderDate: string // YYYY-MM-DD
  message?: string
  status: 'Pending' | 'Replied' | 'Not Replied'
  response?: string
  responseDate?: Date
  createdAt: Date
}

const reminderSchema = new Schema<IReminder>({
  taskId: { type: String, default: 'GENERAL', index: true },
  taskTitle: { type: String },
  employeeId: { type: String, required: true, index: true },
  employeeName: { type: String },
  reminderDate: { type: String, required: true, index: true },
  message: { type: String },
  status: { 
    type: String, 
    enum: ['Pending', 'Replied', 'Not Replied'], 
    default: 'Pending',
    required: true 
  },
  response: { type: String },
  responseDate: { type: Date },
  createdAt: { type: Date, default: Date.now }
})

if (mongoose.models.Reminder) {
  mongoose.deleteModel('Reminder')
}

export default mongoose.model<IReminder>('Reminder', reminderSchema)
