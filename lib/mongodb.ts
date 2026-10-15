import mongoose from 'mongoose'

if (!process.env.MONGODB_URI) {
  throw new Error('Please define the MONGODB_URI environment variable inside .env.local (or in Vercel project settings)')
}

const LOCAL_FALLBACK_URI = 'mongodb://127.0.0.1:27017/taskmanager'
const MONGODB_URI: string = process.env.MONGODB_URI || LOCAL_FALLBACK_URI

/**
 * Global is used here to maintain a cached connection across hot reloads
 * in development. This prevents connections growing exponentially
 * during API Route usage.
 */
declare global {
  var mongoose: any
}

let cached = global.mongoose

if (!cached) {
  cached = global.mongoose = { conn: null, promise: null }
}

async function dbConnect() {
  if (cached.conn && mongoose.connection.readyState === 1) {
    return cached.conn
  }
  if (cached.conn && mongoose.connection.readyState !== 1) {
    cached.conn = null
    cached.promise = null
  }

  if (!cached.promise) {
    const opts = {
      bufferCommands: false,
      serverSelectionTimeoutMS: 5000,
    }

    cached.promise = mongoose.connect(MONGODB_URI, opts)
      .then((mongoose) => {
        console.log('Connected to MongoDB')
        return mongoose
      })
      .catch(async (err) => {
        if (MONGODB_URI !== LOCAL_FALLBACK_URI) {
          console.warn(`[dbConnect] Primary MongoDB connection failed (${err?.message || err}). Falling back to local MongoDB...`)
          return mongoose.connect(LOCAL_FALLBACK_URI, {
            bufferCommands: false,
            serverSelectionTimeoutMS: 5000,
          }).then((m) => {
            console.log('Connected to fallback local MongoDB at', LOCAL_FALLBACK_URI)
            return m
          })
        }
        throw err
      })
  }

  try {
    cached.conn = await cached.promise
  } catch (e) {
    cached.promise = null
    throw e
  }

  return cached.conn
}

export default dbConnect
