import connectToDatabase from './mongodb'
import Employee from '@/models/Employee'
import Project from '@/models/Project'
import Task from '@/models/Task'
import { hashPassword, getTodayKolkata } from './auth'

export async function seedDatabase() {
  await connectToDatabase()

  const defaultPasswordHash = await hashPassword('password')
  const today = getTodayKolkata()

  // Delete old requested/demo employee accounts if present in DB
  await Employee.deleteMany({
    email: {
      $in: [
        'anushinde847@gmail.com',
        'anil123@gmail.com',
        'anilmisale123@gmail.com',
        'admin@company.com',
        'employee@company.com',
        'mahesh@company.com',
        'employee01@company.com'
      ]
    }
  })

  // 1. Seed Real Team Members
  const realUsers = [
    {
      firstName: 'Vishakha',
      lastName: 'Govardhan',
      email: 'director@company.com',
      phone: '9876543210',
      passwordHash: defaultPasswordHash,
      role: 'Director' as const,
      position: 'Director',
      department: 'Management',
      status: 'Active' as const
    },
    {
      firstName: 'Vishakha',
      lastName: 'Govardhan',
      email: 'vishakha@company.com',
      phone: '9876543216',
      passwordHash: defaultPasswordHash,
      role: 'Director' as const,
      position: 'Director',
      department: 'Management',
      status: 'Active' as const
    },
    {
      firstName: 'Sarita',
      lastName: 'Subhadarshini Mohapatra',
      email: 'sarita@koralsdesign.com',
      phone: '9876543213',
      passwordHash: defaultPasswordHash,
      role: 'Project Head' as const,
      position: 'Project Coordinator (Korals Design Pvt. Ltd)',
      department: 'Coordination',
      dateOfBirth: '1988-03-12',
      joiningDate: '2026-09-02',
      status: 'Active' as const
    },
    {
      firstName: 'Sarita',
      lastName: 'Subhadarshini Mohapatra',
      email: 'projecthead@company.com',
      phone: '9876543211',
      passwordHash: defaultPasswordHash,
      role: 'Project Head' as const,
      position: 'Project Coordinator (Korals Design Pvt. Ltd)',
      department: 'Coordination',
      dateOfBirth: '1988-03-12',
      joiningDate: '2026-09-02',
      status: 'Active' as const
    },
    {
      firstName: 'Ganesh',
      lastName: 'Salvi',
      email: 'ganesh@company.com',
      phone: '9876543214',
      passwordHash: defaultPasswordHash,
      role: 'Employee' as const,
      position: 'Staff',
      joiningDate: '2026-05-05',
      status: 'Active' as const
    },
    {
      firstName: 'Pooja',
      lastName: 'Shah',
      email: 'pooja@company.com',
      phone: '9876543215',
      passwordHash: defaultPasswordHash,
      role: 'Employee' as const,
      position: 'Architect',
      joiningDate: '2025-06-02',
      status: 'Active' as const
    },
    {
      firstName: 'Vaishnav',
      lastName: '',
      email: 'vaishnav@company.com',
      phone: '9876543217',
      passwordHash: defaultPasswordHash,
      role: 'Employee' as const,
      position: 'Architect',
      status: 'Active' as const
    },
    {
      firstName: 'Samrudhi',
      lastName: '',
      email: 'samrudhi@company.com',
      phone: '9876543218',
      passwordHash: defaultPasswordHash,
      role: 'Employee' as const,
      position: 'Architect',
      status: 'Active' as const
    },
    {
      firstName: 'Vikram',
      lastName: 'Patole',
      email: 'vikram@company.com',
      phone: '9876543219',
      passwordHash: defaultPasswordHash,
      role: 'Employee' as const,
      position: 'Jr. Architectural Draftsman - (Korals Design Pvt. Ltd)',
      dateOfBirth: '2003-02-19',
      joiningDate: '2024-02-01',
      status: 'Active' as const
    }
  ]

  // Inactivate unused demo accounts
  await Employee.updateMany(
    { email: { $in: ['employee@company.com', 'mahesh@company.com'] } },
    { $set: { status: 'Inactive' } }
  )

  const seededEmployees = []
  for (const userData of realUsers) {
    let emp = await Employee.findOne({ email: userData.email })
    if (!emp) {
      emp = await Employee.create(userData)
    } else {
      emp.firstName = userData.firstName
      emp.lastName = userData.lastName
      emp.role = userData.role
      emp.status = userData.status
      ;(emp as any).position = userData.position || ''
      ;(emp as any).department = (userData as any).department || ''
      ;(emp as any).joiningDate = (userData as any).joiningDate || ''
      ;(emp as any).dateOfBirth = (userData as any).dateOfBirth || ''
      emp.passwordHash = defaultPasswordHash
      await emp.save()
    }
    seededEmployees.push(emp)
  }

  // 2. Real Projects
  const realProjects = [
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
    { projectNumber: '26208', projectName: 'Khed City', description: 'Khed City Project' }
  ]

  const projectNumbers = realProjects.map(p => p.projectNumber)
  // Remove demo projects
  await Project.deleteMany({ projectNumber: { $nin: projectNumbers } })

  const createdProjectIds: string[] = []
  for (const p of realProjects) {
    let proj = await Project.findOne({ projectNumber: p.projectNumber })
    if (!proj) {
      proj = await Project.create({
        ...p,
        status: 'Ongoing',
        location: '',
        contactDetails: '',
        projectRemarks: []
      })
    } else {
      proj.projectName = p.projectName
      proj.description = p.description
      await proj.save()
    }
    createdProjectIds.push(proj._id.toString())
  }

  // Assign projects and active employees to Project Head
  const activeEmpIds = seededEmployees.filter(e => e.role === 'Employee' && e.status === 'Active').map(e => e._id.toString())
  await Employee.updateMany(
    { role: 'Project Head' },
    { $set: { assignedProjects: createdProjectIds, assignedEmployees: activeEmpIds } }
  )

  return { success: true }
}
