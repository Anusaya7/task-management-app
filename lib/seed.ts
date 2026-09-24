import connectToDatabase from './mongodb'
import Employee from '@/models/Employee'
import Project from '@/models/Project'
import Task from '@/models/Task'
import { hashPassword, getTodayKolkata } from './auth'

export async function seedDatabase() {
  await connectToDatabase()

  const defaultPasswordHash = await hashPassword('password')
  const today = getTodayKolkata()

  // Delete old requested employee accounts if present in DB
  await Employee.deleteMany({
    email: { $in: ['anushinde847@gmail.com', 'anil123@gmail.com', 'anilmisale123@gmail.com'] }
  })

  // 1. Seed Demo Accounts & Employees
  const demoUsers = [
    {
      firstName: 'Director',
      lastName: 'Admin',
      email: 'director@company.com',
      phone: '9876543210',
      passwordHash: defaultPasswordHash,
      role: 'Director' as const,
      status: 'Active' as const
    },
    {
      firstName: 'Project',
      lastName: 'Head',
      email: 'projecthead@company.com',
      phone: '9876543211',
      passwordHash: defaultPasswordHash,
      role: 'Project Head' as const,
      status: 'Active' as const
    },
    {
      firstName: 'Employee',
      lastName: 'Demo',
      email: 'employee@company.com',
      phone: '9876543212',
      passwordHash: defaultPasswordHash,
      role: 'Employee' as const,
      status: 'Active' as const
    },
    {
      firstName: 'Sarita',
      lastName: 'Patil',
      email: 'sarita@koralsdesign.com',
      phone: '9876543213',
      passwordHash: defaultPasswordHash,
      role: 'Employee' as const,
      status: 'Active' as const
    },
    {
      firstName: 'Ganesh',
      lastName: 'Kulkarni',
      email: 'ganesh@company.com',
      phone: '9876543214',
      passwordHash: defaultPasswordHash,
      role: 'Employee' as const,
      status: 'Active' as const
    },
    {
      firstName: 'Pooja',
      lastName: 'Deshmukh',
      email: 'pooja@company.com',
      phone: '9876543215',
      passwordHash: defaultPasswordHash,
      role: 'Employee' as const,
      status: 'Active' as const
    },
    {
      firstName: 'Vishakha',
      lastName: 'Joshi',
      email: 'vishakha@company.com',
      phone: '9876543216',
      passwordHash: defaultPasswordHash,
      role: 'Employee' as const,
      status: 'Active' as const
    },
    {
      firstName: 'Vaishnav',
      lastName: 'Shinde',
      email: 'vaishnav@company.com',
      phone: '9876543217',
      passwordHash: defaultPasswordHash,
      role: 'Employee' as const,
      status: 'Active' as const
    },
    {
      firstName: 'Samrudhi',
      lastName: 'More',
      email: 'samrudhi@company.com',
      phone: '9876543218',
      passwordHash: defaultPasswordHash,
      role: 'Employee' as const,
      status: 'Active' as const
    },
    {
      firstName: 'Vikram',
      lastName: 'Rao',
      email: 'vikram@company.com',
      phone: '9876543219',
      passwordHash: defaultPasswordHash,
      role: 'Employee' as const,
      status: 'Active' as const
    },
    {
      firstName: 'Mahesh',
      lastName: 'Chavan',
      email: 'mahesh@company.com',
      phone: '9876543220',
      passwordHash: defaultPasswordHash,
      role: 'Employee' as const,
      status: 'Active' as const
    }
  ]

  const seededEmployees = []
  for (const userData of demoUsers) {
    let emp = await Employee.findOne({ email: userData.email })
    if (!emp) {
      emp = await Employee.create(userData)
      console.log(`Seeded user: ${userData.email}`)
    } else {
      // Ensure password hash is updated to demo password hash
      emp.passwordHash = defaultPasswordHash
      emp.status = userData.status
      emp.role = userData.role
      await emp.save()
    }
    seededEmployees.push(emp)
  }

  const director = seededEmployees.find(e => e.role === 'Director')!
  const projectHead = seededEmployees.find(e => e.role === 'Project Head')!
  const demoEmp = seededEmployees.find(e => e.email === 'employee@company.com')!

  // 2. Seed Sample Projects
  const sampleProjects = [
    {
      projectName: 'Commercial Complex - Tower A',
      projectNumber: '2026-001',
      location: 'Mumbai',
      description: 'Architectural and structural design for 12-story commercial tower',
      contactDetails: 'Client: Apex Infra | +91 9988776655',
      status: 'Current' as const,
      projectRemarks: [
        { date: today, remark: 'Initial architectural drawings finalized', createdBy: director._id.toString() }
      ]
    },
    {
      projectName: 'Residential Villa - Site B',
      projectNumber: '2026-002',
      location: 'Pune',
      description: 'Interior design and site execution for luxury villa',
      contactDetails: 'Client: Mr. Mehta | +91 9822001122',
      status: 'Current' as const,
      projectRemarks: [
        { date: today, remark: 'Site layout survey completed', createdBy: director._id.toString() }
      ]
    },
    {
      projectName: 'School Extension - Block C',
      projectNumber: '2026-003',
      location: 'Nagpur',
      description: 'Building extension and playground layout',
      contactDetails: 'Client: St. Jude Trust | +91 9422114433',
      status: 'Upcoming' as const,
      projectRemarks: []
    }
  ]

  const seededProjects = []
  for (const projData of sampleProjects) {
    let proj = await Project.findOne({ projectNumber: projData.projectNumber })
    if (!proj) {
      proj = await Project.create(projData)
      console.log(`Seeded project: ${projData.projectName}`)
    }
    seededProjects.push(proj)
  }

  // Set Project Head assigned scope
  projectHead.assignedProjects = seededProjects.map(p => p._id.toString())
  projectHead.assignedEmployees = seededEmployees.filter(e => e.role === 'Employee').map(e => e._id.toString())
  await projectHead.save()

  // 3. Seed Sample Tasks
  const proj1 = seededProjects[0]
  const proj2 = seededProjects[1]

  const saritaEmp = seededEmployees.find(e => e.email === 'sarita@koralsdesign.com') || demoEmp

  // Update employee assignedProjects if empty
  if (saritaEmp && (!saritaEmp.assignedProjects || saritaEmp.assignedProjects.length === 0)) {
    saritaEmp.assignedProjects = [proj1._id.toString(), proj2._id.toString()]
    await saritaEmp.save()
  }

  const existingTasksCount = await Task.countDocuments()
  if (existingTasksCount === 0) {
    await Task.create([
      {
        title: 'Prepare Structural Floor Plans',
        description: 'Complete CAD drawings for 3rd and 4th floors of Tower A',
        projectId: proj1._id.toString(),
        projectName: proj1.projectName,
        priority: 'Urgent',
        status: 'Pending',
        assignedById: director._id.toString(),
        assignedByName: `${director.firstName} ${director.lastName}`,
        assignedEmployeeIds: [saritaEmp._id.toString()],
        assignedEmployeeNames: [`${saritaEmp.firstName} ${saritaEmp.lastName}`],
        workDone: 40
      },
      {
        title: 'Electrical Conduit Routing',
        description: 'Detail wiring conduits for basement electrical room',
        projectId: proj2._id.toString(),
        projectName: proj2.projectName,
        priority: 'Medium',
        status: 'Pending',
        assignedById: projectHead._id.toString(),
        assignedByName: `${projectHead.firstName} ${projectHead.lastName}`,
        assignedEmployeeIds: [saritaEmp._id.toString()],
        assignedEmployeeNames: [`${saritaEmp.firstName} ${saritaEmp.lastName}`],
        projectHeadId: projectHead._id.toString(),
        workDone: 20
      }
    ])
    console.log('Seeded initial tasks')
  }

  return { success: true }
}
