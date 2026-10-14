const mongoose = require('mongoose')
const fs = require('fs')
const path = require('path')

function loadEnv() {
  const envPath = path.join(__dirname, '..', '.env.local')
  const raw = fs.readFileSync(envPath, 'utf8')
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const idx = trimmed.indexOf('=')
    if (idx === -1) continue
    const key = trimmed.slice(0, idx).trim()
    const value = trimmed.slice(idx + 1).trim()
    if (!process.env[key]) process.env[key] = value
  }
}

loadEnv()

async function main() {
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 15000 })
  const db = mongoose.connection.db
  const collections = await db.listCollections().toArray()
  console.log('collections:', collections.map(c => c.name).join(', '))

  const employees = db.collection('employees')
  const all = await employees.find({}, {
    projection: { firstName: 1, lastName: 1, email: 1, role: 1, status: 1 }
  }).toArray()

  console.log('employee_count:', all.length)
  for (const emp of all) {
    console.log(`${emp.role || 'NO_ROLE'} | ${emp.status ?? 'NO_STATUS'} | ${emp.email} | ${emp.firstName} ${emp.lastName}`)
  }

  const directors = all.filter(e => String(e.role || '').toLowerCase() === 'director')
  const result = await employees.updateMany(
    { role: 'Director', status: { $nin: ['Active', 'Absent'] } },
    { $set: { status: 'Active', updatedAt: new Date() } }
  )
  console.log('directors:', directors.length)
  console.log('reactivated_matched:', result.matchedCount)
  console.log('reactivated_modified:', result.modifiedCount)

  await mongoose.disconnect()
}

main().catch(err => {
  console.error('SCRIPT_FAILED:', err.message)
  process.exit(1)
})
