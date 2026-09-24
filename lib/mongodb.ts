import mongoose from 'mongoose'

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://ghodehimanshu453:6YeUjmeewSV9zpM5@cluster0.uo4qa7m.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0'

/**
 * Global is used here to maintain a cached connection across hot reloads
 * in development. This prevents connections growing exponentially
 * during API Route usage.
 */
declare global {
  var mongoose: any
  var mongoMemoryServer: any
}

let cached = global.mongoose

if (!cached) {
  cached = global.mongoose = { conn: null, promise: null }
}

async function dbConnect() {
  if (cached.conn) {
    return cached.conn
  }

  if (!cached.promise) {
    const opts = {
      bufferCommands: false,
      serverSelectionTimeoutMS: 4000,
    }

    cached.promise = mongoose.connect(MONGODB_URI, opts)
      .then((mongoose) => {
        console.log('✅ Connected to Primary MongoDB')
        return mongoose
      })
      .catch(async (err) => {
        console.warn('⚠️ Could not connect to primary MONGODB_URI:', err.message)
        console.log('🔄 Launching In-Memory MongoDB Server fallback...')
        try {
          const { MongoMemoryServer } = eval('require')('mongodb-memory-server')
          if (!global.mongoMemoryServer) {
            global.mongoMemoryServer = await MongoMemoryServer.create()
          }
          const memoryUri = global.mongoMemoryServer.getUri()
          console.log('✅ Connected to In-Memory MongoDB:', memoryUri)
          const conn = await mongoose.connect(memoryUri, { bufferCommands: false })
          return conn
        } catch (memErr: any) {
          console.error('❌ Failed to launch MongoMemoryServer:', memErr.message)
          throw err
        }
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

