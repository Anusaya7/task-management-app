import mongoose, { Document, Schema } from 'mongoose'

export interface IAttendance extends Document {
  employeeId: string
  employeeName?: string
  date: string // YYYY-MM-DD
  status: 'Active' | 'Absent' | 'Inactive'
  markedBy: string
  actionTaken?: 'Carry Forward' | 'Reassign' | 'Keep On Hold'
  createdAt: Date
}

const attendanceSchema = new Schema<IAttendance>({
  employeeId: { type: String, required: true, index: true },
  employeeName: { type: String },
  date: { type: String, required: true, index: true },
  status: { type: String, enum: ['Active', 'Absent', 'Inactive'], required: true },
  markedBy: { type: String, required: true },
  actionTaken: { type: String, enum: ['Carry Forward', 'Reassign', 'Keep On Hold'] },
  createdAt: { type: Date, default: Date.now }
})

if (mongoose.models.Attendance) {
  mongoose.deleteModel('Attendance')
}

export default mongoose.model<IAttendance>('Attendance', attendanceSchema)
