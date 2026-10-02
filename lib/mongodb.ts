import mongoose from 'mongoose'

const MONGODB_URI = process.env.MONGODB_URI

if (!MONGODB_URI) {
  throw new Error('Please define the MONGODB_URI environment variable inside .env.local (or in Vercel project settings)')
}

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
      serverSelectionTimeoutMS: (process.env.VERCEL || process.env.NODE_ENV === 'production') ? 10000 : 2000,
    }

    cached.promise = mongoose.connect(MONGODB_URI, opts)
      .then((mongoose) => {
        console.log('✅ Connected to Primary MongoDB')
        return mongoose
      })
      .catch(async (err) => {
        console.warn('⚠️ Could not connect to primary MONGODB_URI:', err.message)
        cached.promise = null
        
        // MongoMemoryServer fallback only in local development (not on Vercel/production)
        if (process.env.NODE_ENV === 'development' && !process.env.VERCEL) {
          console.log('🔄 Launching In-Memory MongoDB Server fallback...')
          try {
            const { MongoMemoryServer } = eval('require')('mongodb-memory-server')
            if (!global.mongoMemoryServer) {
              global.mongoMemoryServer = await MongoMemoryServer.create()
            }
            const memoryUri = global.mongoMemoryServer.getUri()
            console.log('✅ Connected to In-Memory MongoDB:', memoryUri)
            if (mongoose.connection.readyState !== 0) {
              await mongoose.disconnect()
            }
            const conn = await mongoose.connect(memoryUri, { bufferCommands: false })
            return conn
          } catch (memErr: any) {
            console.error('❌ Failed to launch MongoMemoryServer:', memErr.message)
            throw err
          }
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

