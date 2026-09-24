import mongoose, { Document, Schema } from 'mongoose'

export interface ITaskHistory extends Document {
  taskId: string
  date: string // YYYY-MM-DD
  employeeId: string
  employeeName?: string
  role?: string
  action: string
  remark: string
  workDone: number
  status: string
  createdAt: Date
}

const taskHistorySchema = new Schema<ITaskHistory>({
  taskId: { type: String, required: true, index: true },
  date: { type: String, required: true, index: true },
  employeeId: { type: String, required: true },
  employeeName: { type: String },
  role: { type: String },
  action: { type: String, required: true },
  remark: { type: String, default: '' },
  workDone: { type: Number, required: true, min: 0, max: 100 },
  status: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
})

if (mongoose.models.TaskHistory) {
  mongoose.deleteModel('TaskHistory')
}

export default mongoose.model<ITaskHistory>('TaskHistory', taskHistorySchema)
