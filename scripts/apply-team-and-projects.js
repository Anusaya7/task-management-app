const mongoose = require('mongoose')
const bcrypt = require('bcryptjs')
const path = require('path')
const fs = require('fs')

const ROOT = path.join(__dirname, '..')

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

const env = loadEnvLocal()
const MONGODB_URI = process.env.MONGODB_URI || env.MONGODB_URI || 'mongodb://127.0.0.1:27017/taskmanager'

async function run() {
  console.log('Connecting to database:', MONGODB_URI)
  await mongoose.connect(MONGODB_URI, { bufferCommands: false, serverSelectionTimeoutMS: 5000 })
  const db = mongoose.connection.db
  const Project = db.collection('projects')
  const Employee = db.collection('employees')
  const Task = db.collection('tasks')

  console.log('\n--- 1. CLEANING UP OLD / DEMO PROJECTS ---')
  const requestedProjectNumbers = [
    '22120', '23132', '26194', '26196', '26197',
    '26200', '26201', '26202', '26203', '26204',
    '26205', '26206', '26207', '26208'
  ]

  // Find demo projects not in the requested list
  const demoProjects = await Project.find({ projectNumber: { $nin: requestedProjectNumbers } }).toArray()
  const demoProjectIds = demoProjects.map(p => p._id.toString())
  console.log('Removing demo projects:', demoProjects.map(p => `${p.projectNumber} - ${p.projectName}`))

  if (demoProjectIds.length > 0) {
    const delTasks = await Task.deleteMany({ projectId: { $in: demoProjectIds } })
    console.log(`Removed ${delTasks.deletedCount} demo tasks linked to old projects.`)
    const delProj = await Project.deleteMany({ _id: { $in: demoProjects.map(p => p._id) } })
    console.log(`Deleted ${delProj.deletedCount} demo projects.`)
  }

  console.log('\n--- 2. ADDING / UPDATING REAL PROJECTS ---')
  const projectsData = [
    { projectNumber: '22120', projectName: 'SANDESH GASES', description: 'SANDESH GASES Project' },
    { projectNumber: '23132', projectName: 'WMDC', description: 'WMDC Project' },
    { projectNumber: '26194', projectName: 'MR. GANDHI HOTEL', description: 'MR. GANDHI HOTEL Project' },
    { projectNumber: '26196', projectName: 'ZP model School PH-2', description: 'ZP model School PH-2 Project' },
    { projectNumber: '26197', projectName: 'ZP PHC-Shirur', description: 'ZP PHC-Shirur Project' },
    { projectNumber: '26200', projectName: 'Bhondve', description: 'Bhondve Project' },
    { projectNumber: '26201', projectName: 'KAMAYANI', description: 'KAMAYANI Project' },
    { projectNumber: '26202', projectName: 'GREENJOULES', description: 'GREENJOULES Project' },
    { projectNumber: '26203', projectName: 'METRIC AUTO SOLUTION', description: 'METRIC AUTO SOLUTION Project' },
    { projectNumber: '26204', projectName: 'ZP SASWAD', description: 'ZP SASWAD Project' },
    { projectNumber: '26205', projectName: 'ZP JEJURI', description: 'ZP JEJURI Project' },
    { projectNumber: '26206', projectName: 'ZP Mahila Kaksha', description: 'ZP Mahila Kaksha Project' },
    { projectNumber: '26207', projectName: 'WIPL', description: 'WIPL Project' },
    { projectNumber: '26208', projectName: 'Khed City', description: 'Khed City Project' },
  ]

  const createdProjectIds = []
  for (const item of projectsData) {
    const existing = await Project.findOne({ projectNumber: item.projectNumber })
    if (existing) {
      await Project.updateOne(
        { _id: existing._id },
        {
          $set: {
            projectName: item.projectName,
            description: item.description,
            status: existing.status || 'Ongoing',
            updatedAt: new Date()
          }
        }
      )
      console.log(`Updated project: ${item.projectNumber} - ${item.projectName}`)
      createdProjectIds.push(existing._id.toString())
    } else {
      const ins = await Project.insertOne({
        projectNumber: item.projectNumber,
        projectName: item.projectName,
        description: item.description,
        location: '',
        contactDetails: '',
        projectRemarks: [],
        status: 'Ongoing',
        createdAt: new Date(),
        updatedAt: new Date()
      })
      console.log(`Created project: ${item.projectNumber} - ${item.projectName}`)
      createdProjectIds.push(ins.insertedId.toString())
    }
  }

  console.log('\n--- 3. ADDING / UPDATING TEAM MEMBERS ---')
  const defaultPasswordHash = await bcrypt.hash('password', 10)

  const teamMembers = [
    {
      firstName: 'Vishakha',
      lastName: 'Govardhan',
      email: 'director@company.com',
      phone: '9876543210',
      role: 'Director',
      position: 'Director',
      department: 'Management',
      status: 'Active'
    },
    {
      firstName: 'Vishakha',
      lastName: 'Govardhan',
      email: 'vishakha@company.com',
      phone: '9876543216',
      role: 'Director',
      position: 'Director',
      department: 'Management',
      status: 'Active'
    },
    {
      firstName: 'Sarita',
      lastName: 'Subhadarshini Mohapatra',
      email: 'sarita@koralsdesign.com',
      phone: '9876543213',
      role: 'Project Head',
      position: 'Project Coordinator (Korals Design Pvt. Ltd)',
      department: 'Coordination',
      dateOfBirth: '1988-03-12',
      joiningDate: '2026-09-02',
      status: 'Active',
      assignedProjects: createdProjectIds
    },
    {
      firstName: 'Sarita',
      lastName: 'Subhadarshini Mohapatra',
      email: 'projecthead@company.com',
      phone: '9876543211',
      role: 'Project Head',
      position: 'Project Coordinator (Korals Design Pvt. Ltd)',
      department: 'Coordination',
      dateOfBirth: '1988-03-12',
      joiningDate: '2026-09-02',
      status: 'Active',
      assignedProjects: createdProjectIds
    },
    {
      firstName: 'Ganesh',
      lastName: 'Salvi',
      email: 'ganesh@company.com',
      phone: '9876543214',
      role: 'Employee',
      position: 'Staff',
      joiningDate: '2026-05-05',
      status: 'Active'
    },
    {
      firstName: 'Pooja',
      lastName: 'Shah',
      email: 'pooja@company.com',
      phone: '9876543215',
      role: 'Employee',
      position: 'Architect',
      joiningDate: '2025-06-02',
      status: 'Active'
    },
    {
      firstName: 'Vaishnav',
      lastName: '',
      email: 'vaishnav@company.com',
      phone: '9876543217',
      role: 'Employee',
      position: 'Architect',
      status: 'Active'
    },
    {
      firstName: 'Samrudhi',
      lastName: '',
      email: 'samrudhi@company.com',
      phone: '9876543218',
      role: 'Employee',
      position: 'Architect',
      status: 'Active'
    },
    {
      firstName: 'Vikram',
      lastName: 'Patole',
      email: 'vikram@company.com',
      phone: '9876543219',
      role: 'Employee',
      position: 'Jr. Architectural Draftsman - (Korals Design Pvt. Ltd)',
      dateOfBirth: '2003-02-19',
      joiningDate: '2024-02-01',
      status: 'Active'
    }
  ]

  // Delete unused demo accounts so only real team members appear
  await Employee.deleteMany(
    { email: { $in: ['employee@company.com', 'mahesh@company.com'] } }
  )

  for (const m of teamMembers) {
    const existing = await Employee.findOne({ email: m.email.toLowerCase() })
    if (existing) {
      await Employee.updateOne(
        { _id: existing._id },
        {
          $set: {
            firstName: m.firstName,
            lastName: m.lastName,
            role: m.role,
            status: m.status,
            position: m.position || '',
            department: m.department || '',
            joiningDate: m.joiningDate || '',
            dateOfBirth: m.dateOfBirth || '',
            phone: m.phone || existing.phone,
            passwordHash: defaultPasswordHash,
            assignedProjects: m.assignedProjects || existing.assignedProjects || [],
            updatedAt: new Date()
          }
        }
      )
      console.log(`Updated team member: ${m.firstName} ${m.lastName} (${m.role}) -> ${m.email}`)
    } else {
      await Employee.insertOne({
        ...m,
        email: m.email.toLowerCase(),
        passwordHash: defaultPasswordHash,
        assignedProjects: m.assignedProjects || [],
        assignedEmployees: [],
        createdAt: new Date(),
        updatedAt: new Date()
      })
      console.log(`Created team member: ${m.firstName} ${m.lastName} (${m.role}) -> ${m.email}`)
    }
  }

  // Update Project Head's allowed employees to all active employees
  const allEmployees = await Employee.find({ role: 'Employee', status: 'Active' }).toArray()
  const allEmployeeIds = allEmployees.map(e => e._id.toString())
  await Employee.updateMany(
    { role: 'Project Head' },
    { $set: { assignedEmployees: allEmployeeIds, assignedProjects: createdProjectIds } }
  )
  console.log(`Assigned all ${createdProjectIds.length} projects and ${allEmployeeIds.length} employees to Project Head accounts.`)

  console.log('\n--- VERIFICATION ---')
  const finalProjects = await Project.find({}).toArray()
  console.log(`Total projects in DB: ${finalProjects.length}`)
  console.log(finalProjects.map(p => `${p.projectNumber}: ${p.projectName}`))

  const finalEmployees = await Employee.find({ status: 'Active' }).toArray()
  console.log(`Total active team members: ${finalEmployees.length}`)
  console.log(finalEmployees.map(e => `${e.firstName} ${e.lastName} [${e.role} - ${e.position || 'Staff'}] (${e.email})`))

  await mongoose.disconnect()
  console.log('\nDone successfully!')
}

run().catch((err) => {
  console.error('Error updating projects and team:', err)
  process.exit(1)
})
