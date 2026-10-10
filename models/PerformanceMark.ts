import mongoose, { Document, Schema } from 'mongoose'

export interface IPerformanceMark extends Document {
  employeeId: string
  projectId: string
  periodStart: string
  periodEnd: string
  rating: number
  comment: string
  directorId: string
  createdAt: Date
  updatedAt: Date
}

const performanceMarkSchema = new Schema<IPerformanceMark>({
  employeeId: { type: String, required: true, index: true },
  projectId: { type: String, required: true, default: 'all' },
  periodStart: { type: String, required: true },
  periodEnd: { type: String, required: true },
  rating: { type: Number, required: true, min: 1, max: 5 },
  comment: { type: String, required: true },
  directorId: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
})

performanceMarkSchema.index(
  { employeeId: 1, projectId: 1, periodStart: 1 },
  { unique: true }
)

if (mongoose.models.PerformanceMark) {
  mongoose.deleteModel('PerformanceMark')
}

export default mongoose.model<IPerformanceMark>('PerformanceMark', performanceMarkSchema)
