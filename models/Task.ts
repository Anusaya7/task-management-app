import mongoose, { Document, Schema } from 'mongoose'

export interface ITask extends Document {
  title: string
  description: string
  projectId: string
  projectName?: string
  priority: 'Urgent' | 'Medium' | 'Low' | 'Self' | 'Daily'
  status: 'Pending' | 'In Progress' | 'Pending Approval' | 'Completed' | 'Carried Forward' | 'Reassigned' | 'Not Updated' | 'Not Replied' | 'Revision Required'
  assignedById: string
  assignedByName?: string
  assignedEmployeeIds: string[]
  assignedEmployeeNames?: string[]
  assigneeProgress?: Array<{
    employeeId: string
    employeeName?: string
    status: 'Pending' | 'In Progress' | 'Pending Approval' | 'Completed' | 'Carried Forward' | 'Reassigned' | 'Not Updated' | 'Not Replied' | 'Revision Required'
    workDone: number
    lastSubmittedAt?: Date
  }>
  projectHeadId?: string
  workDone: number
  reminderDate?: string
  reminderInterval?: string
  completionRequestedDate?: Date
  approvedBy?: string
  approvalDate?: Date
  approvalRemarks?: string
  employeeRemark?: string
  directorRemark?: string
  projectHeadRemark?: string
  flagStatus?: 'Open' | 'Resolved' | 'None'
  flagMessage?: string
  flagDate?: string
  dueDate?: string
  parentTaskId?: string
  parentTaskTitle?: string
  taskCode?: string
  estimatedHours?: number
  createdAt: Date
  updatedAt: Date
}

const taskSchema = new Schema<ITask>({
  title: { type: String, required: true },
  description: { type: String, required: true },
  projectId: { type: String, required: true },
  projectName: { type: String },
  priority: {
    type: String,
    enum: ['Urgent', 'Medium', 'Low', 'Self', 'Daily'],
    required: true,
    default: 'Medium'
  },
  status: {
    type: String,
    enum: [
      'Pending',
      'In Progress',
      'Pending Approval',
      'Completed',
      'Carried Forward',
      'Reassigned',
      'Not Updated',
      'Not Replied',
      'Revision Required'
    ],
    required: true,
    default: 'Pending'
  },
  assignedById: { type: String, required: true },
  assignedByName: { type: String },
  assignedEmployeeIds: [{ type: String, required: true }],
  assignedEmployeeNames: [{ type: String }],
  assigneeProgress: [{
    employeeId: { type: String, required: true },
    employeeName: { type: String },
    status: {
      type: String,
      enum: [
        'Pending',
        'In Progress',
        'Pending Approval',
        'Completed',
        'Carried Forward',
        'Reassigned',
        'Not Updated',
        'Not Replied',
        'Revision Required'
      ],
      default: 'Pending'
    },
    workDone: { type: Number, min: 0, max: 100, default: 0 },
    lastSubmittedAt: { type: Date }
  }],
  projectHeadId: { type: String },
  workDone: { type: Number, min: 0, max: 100, default: 0 },
  reminderDate: { type: String },
  reminderInterval: { type: String },
  completionRequestedDate: { type: Date },
  approvedBy: { type: String },
  approvalDate: { type: Date },
  approvalRemarks: { type: String },
  employeeRemark: { type: String },
  directorRemark: { type: String },
  projectHeadRemark: { type: String },
  flagStatus: { type: String, enum: ['Open', 'Resolved', 'None'], default: 'None' },
  flagMessage: { type: String },
  flagDate: { type: String },
  dueDate: { type: String },
  parentTaskId: { type: String },
  parentTaskTitle: { type: String },
  taskCode: { type: String },
  estimatedHours: { type: Number, min: 0 },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
})

if (mongoose.models.Task) {
  mongoose.deleteModel('Task')
}

export default mongoose.model<ITask>('Task', taskSchema)
