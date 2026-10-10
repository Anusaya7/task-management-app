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
  attachments?: Array<{
    id: string
    fileName: string
    fileType: string
    fileSize: number
    data: string
  }>
  commentHistory?: Array<{
    previousContent: string
    updatedContent: string
    editorId: string
    editorName: string
    editorRole: string
    editedAt: Date
  }>
  commentLastEditedByName?: string
  commentLastEditedAt?: Date
  date: string // YYYY-MM-DD (Asia/Kolkata)
  hours: number
  flagged: boolean
  flagComment?: string
  reviewedById?: string
  reviewedByName?: string
  reviewedAt?: Date
  status: 'Pending' | 'In Progress' | 'Completed' | 'Blocked' | 'Submitted'
  createdAt: Date
  updatedAt: Date
}

const dailyEntryAttachmentSchema = new Schema({
  id: { type: String, required: true },
  fileName: { type: String, required: true },
  fileType: { type: String, required: true },
  fileSize: { type: Number, required: true },
  data: { type: String, required: true }
}, { _id: false })

const dailyEntryCommentEditSchema = new Schema({
  previousContent: { type: String, required: true },
  updatedContent: { type: String, required: true },
  editorId: { type: String, required: true },
  editorName: { type: String, required: true },
  editorRole: { type: String, required: true },
  editedAt: { type: Date, required: true }
}, { _id: false })

const dailyEntrySchema = new Schema<IDailyEntry>({
  employeeId: { type: String, required: true, index: true },
  employeeName: { type: String },
  taskId: { type: String, required: true },
  projectId: { type: String, required: true },
  projectName: { type: String },
  taskTitle: { type: String, required: true },
  details: { type: String },
  actionTaken: { type: String, required: true },
  attachments: { type: [dailyEntryAttachmentSchema], default: [] },
  commentHistory: { type: [dailyEntryCommentEditSchema], default: [] },
  commentLastEditedByName: { type: String },
  commentLastEditedAt: { type: Date },
  date: { type: String, required: true, index: true },
  hours: { type: Number, required: true, min: 0, max: 24 },
  flagged: { type: Boolean, default: false },
  flagComment: { type: String },
  reviewedById: { type: String },
  reviewedByName: { type: String },
  reviewedAt: { type: Date },
  status: {
    type: String,
    enum: ['Pending', 'In Progress', 'Completed', 'Blocked', 'Submitted'],
    default: 'Submitted'
  },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
})

if (mongoose.models.DailyEntry) {
  mongoose.deleteModel('DailyEntry')
}

export default mongoose.model<IDailyEntry>('DailyEntry', dailyEntrySchema)
