import mongoose, { Document, Schema } from 'mongoose'

export interface IDailyEntry extends Document {
  employeeId: string
  employeeName?: string
  taskId: string
  projectId: string
  projectName?: string
  taskTitle: string
  details?: string
  actionTaken: string
  date: string // YYYY-MM-DD (Asia/Kolkata)
  hours: number
  flagged: boolean
  flagComment?: string
  status: 'Pending' | 'In Progress' | 'Completed' | 'Blocked'
  createdAt: Date
  updatedAt: Date
}

const dailyEntrySchema = new Schema<IDailyEntry>({
  employeeId: { type: String, required: true, index: true },
  employeeName: { type: String },
  taskId: { type: String, required: true },
  projectId: { type: String, required: true },
  projectName: { type: String },
  taskTitle: { type: String, required: true },
  details: { type: String },
  actionTaken: { type: String, required: true },
  date: { type: String, required: true, index: true },
  hours: { type: Number, required: true, min: 0.1, max: 8 },
  flagged: { type: Boolean, default: false },
  flagComment: { type: String },
  status: {
    type: String,
    enum: ['Pending', 'In Progress', 'Completed', 'Blocked'],
    default: 'Pending'
  },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
})

if (mongoose.models.DailyEntry) {
  mongoose.deleteModel('DailyEntry')
}

export default mongoose.model<IDailyEntry>('DailyEntry', dailyEntrySchema)
