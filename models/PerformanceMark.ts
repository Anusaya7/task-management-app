import mongoose, { Document, Schema } from 'mongoose'

export interface IPerformanceMark extends Document {
  employeeId: string
  projectId: string
  periodStart: string
  periodEnd: string
  rating?: number
  ratingScale?: number
  comment?: string
  directorId?: string
  selfRating?: number
  selfComment?: string
  selfSubmittedAt?: Date
  coordinatorRating?: number
  coordinatorComment?: string
  coordinatorId?: string
  createdAt: Date
  updatedAt: Date
}

const performanceMarkSchema = new Schema<IPerformanceMark>({
  employeeId: { type: String, required: true, index: true },
  projectId: { type: String, required: true, default: 'all' },
  periodStart: { type: String, required: true },
  periodEnd: { type: String, required: true },
  rating: { type: Number, min: 1, max: 10 },
  ratingScale: { type: Number, enum: [5, 10], default: 10 },
  comment: { type: String, default: '' },
  directorId: { type: String },
  selfRating: { type: Number, min: 1, max: 10 },
  selfComment: { type: String, default: '' },
  selfSubmittedAt: { type: Date },
  coordinatorRating: { type: Number, min: 1, max: 10 },
  coordinatorComment: { type: String, default: '' },
  coordinatorId: { type: String },
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
