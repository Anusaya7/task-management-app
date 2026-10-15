const { spawn } = require('child_process')
const fs = require('fs')
const path = require('path')
const mongoose = require('mongoose')

const ROOT = path.join(__dirname, '..')
const DATA_DIR = path.join(ROOT, '.mongo-data')

function loadEnvLocal() {
  const envPath = path.join(ROOT, '.env.local')
  const env = {}
  if (!fs.existsSync(envPath)) return env
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const idx = trimmed.indexOf('=')
    if (idx === -1) continue
    env[trimmed.slice(0, idx).trim()] = trimmed.slice(idx + 1).trim()
  }
  return env
}

async function canConnect(uri) {
  if (!uri) return false
  try {
    const conn = await mongoose.createConnection(uri, {
      bufferCommands: false,
      serverSelectionTimeoutMS: 2500,
    }).asPromise()
    await conn.close()
    return true
  } catch {
    return false
  }
}

async function startLocalMongo() {
  const { MongoMemoryServer } = require('mongodb-memory-server')
  fs.mkdirSync(DATA_DIR, { recursive: true })
  console.log('Starting local MongoDB for development...')
  const mongod = await MongoMemoryServer.create({
    instance: {
      dbName: 'taskmanager',
      dbPath: DATA_DIR,
      launchTimeout: 120000,
    },
  })
  return mongod
}

async function main() {
  const fileEnv = loadEnvLocal()
  const configuredUri = process.env.MONGODB_URI || fileEnv.MONGODB_URI || 'mongodb://127.0.0.1:27017/taskmanager'
  let mongoServer = null
  let mongoUri = configuredUri

  if (await canConnect(configuredUri)) {
    console.log('Connected to MongoDB from URI:', configuredUri)
  } else if (await canConnect('mongodb://127.0.0.1:27017/taskmanager')) {
    mongoUri = 'mongodb://127.0.0.1:27017/taskmanager'
    console.log('Using local MongoDB on port 27017')
  } else {
    mongoServer = await startLocalMongo()
    mongoUri = mongoServer.getUri('taskmanager')
    console.log('Using local MongoDB instance for development')
  }

  const env = {
    ...process.env,
    MONGODB_URI: mongoUri,
    JWT_SECRET: process.env.JWT_SECRET || fileEnv.JWT_SECRET || 'taskmanager_local_dev_secret_2026',
  }

  const child = spawn(
    process.execPath,
    ['--max-old-space-size=4096', path.join('node_modules', 'next', 'dist', 'bin', 'next'), 'dev', ...process.argv.slice(2)],
    { cwd: ROOT, env, stdio: 'inherit' }
  )

  const shutdown = async (code = 0) => {
    if (child && !child.killed) {
      child.kill()
    }
    if (mongoServer) {
      try {
        await mongoServer.stop()
      } catch {}
    }
    process.exit(code)
  }

  process.on('SIGINT', () => shutdown(0))
  process.on('SIGTERM', () => shutdown(0))
  child.on('exit', (code) => shutdown(code ?? 0))
}

main().catch((err) => {
  console.error('Failed to start local development server:', err && err.message ? err.message : err)
  process.exit(1)
})
