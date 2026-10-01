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

  // Clean up old sample project and task records as requested
  await Project.deleteMany({ projectNumber: { $in: ['2026-001', '2026-002', '2026-003'] } })
  await Task.deleteMany({ title: { $in: ['Prepare Structural Floor Plans', 'Electrical Conduit Routing'] } })

  return { success: true }
}
