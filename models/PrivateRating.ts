import mongoose, { Document, Schema } from 'mongoose'

export interface IPrivateRating extends Document {
  taskId: string
  employeeId: string
  directorId: string
  rating: number // 1 - 5
  privateComment?: string
  createdAt: Date
}

const privateRatingSchema = new Schema<IPrivateRating>({
  taskId: { type: String, required: true, index: true },
  employeeId: { type: String, required: true, index: true },
  directorId: { type: String, required: true },
  rating: { type: Number, required: true, min: 1, max: 5 },
  privateComment: { type: String },
  createdAt: { type: Date, default: Date.now }
})

if (mongoose.models.PrivateRating) {
  mongoose.deleteModel('PrivateRating')
}

export default mongoose.model<IPrivateRating>('PrivateRating', privateRatingSchema)
