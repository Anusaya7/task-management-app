import mongoose, { Document, Schema } from 'mongoose'

export interface IProject extends Document {
  projectName: string
  projectNumber: string
  location?: string
  description: string
  contactDetails?: string
  projectRemarks: Array<{
    date: string
    remark: string
    createdBy?: string
  }>
  status: 'Current' | 'Upcoming' | 'Sleeping (On Hold)' | 'Completed'
  createdAt: Date
  updatedAt: Date
}

const projectSchema = new Schema<IProject>({
  projectName: { type: String, required: true },
  projectNumber: { type: String, required: true },
  location: { type: String, required: false },
  description: { type: String, required: true },
  contactDetails: { type: String, required: false },
  projectRemarks: [{
    date: { type: String, required: true },
    remark: { type: String, required: true },
    createdBy: { type: String }
  }],
  status: { 
    type: String, 
    enum: ['Current', 'Upcoming', 'Sleeping (On Hold)', 'Completed'],
    default: 'Current',
    required: true
  },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
})

if (mongoose.models.Project) {
  mongoose.deleteModel('Project')
}

export default mongoose.model<IProject>('Project', projectSchema)
