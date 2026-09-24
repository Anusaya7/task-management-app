import mongoose, { Document, Schema } from 'mongoose'

export interface ITaskAssignmentHistory extends Document {
  taskId: string
  previousEmployeeId?: string
  newEmployeeId: string
  assignedById: string
  assignedByName?: string
  date: string
  reason?: string
  createdAt: Date
}

const taskAssignmentHistorySchema = new Schema<ITaskAssignmentHistory>({
  taskId: { type: String, required: true, index: true },
  previousEmployeeId: { type: String },
  newEmployeeId: { type: String, required: true },
  assignedById: { type: String, required: true },
  assignedByName: { type: String },
  date: { type: String, required: true },
  reason: { type: String },
  createdAt: { type: Date, default: Date.now }
})

if (mongoose.models.TaskAssignmentHistory) {
  mongoose.deleteModel('TaskAssignmentHistory')
}

export default mongoose.model<ITaskAssignmentHistory>('TaskAssignmentHistory', taskAssignmentHistorySchema)
