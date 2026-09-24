import mongoose, { Document, Schema } from 'mongoose'

export interface IEmployee extends Document {
  firstName: string
  lastName: string
  email: string
  phone: string
  passwordHash: string
  role: 'Director' | 'Project Head' | 'Employee'
  status: 'Active' | 'Absent' | 'Inactive'
  assignedProjects?: string[]
  assignedEmployees?: string[]
  createdAt: Date
  updatedAt: Date
}

const employeeSchema = new Schema<IEmployee>({
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  phone: { type: String, required: true },
  passwordHash: { type: String, required: true },
  role: { 
    type: String, 
    enum: ['Director', 'Project Head', 'Employee'], 
    required: true,
    default: 'Employee' 
  },
  status: { 
    type: String, 
    enum: ['Active', 'Absent', 'Inactive'], 
    required: true,
    default: 'Active' 
  },
  assignedProjects: [{ type: String }],
  assignedEmployees: [{ type: String }],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
})

if (mongoose.models.Employee) {
  mongoose.deleteModel('Employee')
}

export default mongoose.model<IEmployee>('Employee', employeeSchema)
