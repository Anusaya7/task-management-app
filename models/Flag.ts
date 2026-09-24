import mongoose, { Document, Schema } from 'mongoose'

export interface IFlagReply {
  userId: string
  userName: string
  userRole: string
  message: string
  createdAt: Date
}

export interface IFlag extends Document {
  taskId: string
  taskTitle?: string
  employeeId: string
  employeeName?: string
  createdBy?: string
  createdByRole?: string
  flagType?: string
  flagMessage: string
  flagDate: string // YYYY-MM-DD
  status: 'Open' | 'Resolved'
  managementResponse?: string
  replies?: IFlagReply[]
  resolvedBy?: string
  resolvedAt?: Date
  createdAt: Date
}

const flagReplySchema = new Schema<IFlagReply>({
  userId: { type: String, required: true },
  userName: { type: String, required: true },
  userRole: { type: String, required: true },
  message: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
})

const flagSchema = new Schema<IFlag>({
  taskId: { type: String, required: true, index: true },
  taskTitle: { type: String },
  employeeId: { type: String, required: true, index: true },
  employeeName: { type: String },
  createdBy: { type: String },
  createdByRole: { type: String },
  flagType: { type: String },
  flagMessage: { type: String, required: true },
  flagDate: { type: String, required: true },
  status: { type: String, enum: ['Open', 'Resolved'], default: 'Open', required: true },
  managementResponse: { type: String },
  replies: [flagReplySchema],
  resolvedBy: { type: String },
  resolvedAt: { type: Date },
  createdAt: { type: Date, default: Date.now }
})

if (mongoose.models.Flag) {
  mongoose.deleteModel('Flag')
}

export default mongoose.model<IFlag>('Flag', flagSchema)
