export type UserRole = 'Director' | 'Project Head' | 'Employee';
export type EmployeeStatus = 'Active' | 'Absent' | 'Inactive';
export type ProjectStatus = 'Current' | 'Upcoming' | 'Sleeping (On Hold)' | 'Completed';
export type TaskPriority = 'Urgent' | 'Medium' | 'Low' | 'Self' | 'Daily';
export type TaskStatus = 
  | 'Pending' 
  | 'In Progress' 
  | 'Pending Approval' 
  | 'Completed' 
  | 'Carried Forward' 
  | 'Reassigned' 
  | 'Not Updated' 
  | 'Not Replied'
  | 'Revision Required';

export interface User {
  id: string;
  _id?: string;
  name: string;
  email: string;
  role: UserRole;
  status?: EmployeeStatus;
  phone?: string;
  firstName?: string;
  lastName?: string;
}

export interface ProjectRemark {
  date: string;
  remark: string;
  createdBy?: string;
}

export interface Project {
  id?: string;
  _id?: string;
  projectName: string;
  projectNumber: string;
  location?: string;
  description: string;
  contactDetails?: string;
  projectRemarks?: ProjectRemark[];
  status: ProjectStatus;
  createdAt?: string;
  updatedAt?: string;
}

export interface Employee {
  id?: string;
  _id?: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  role: UserRole;
  status: EmployeeStatus;
  assignedProjects?: string[]; // IDs of assigned projects for Project Head
  assignedEmployees?: string[]; // IDs of allowed employees for Project Head
  createdAt?: string;
  updatedAt?: string;
}

export interface TaskHistoryRecord {
  id?: string;
  _id?: string;
  taskId: string;
  date: string; // YYYY-MM-DD (Asia/Kolkata)
  employeeId: string;
  employeeName?: string;
  role?: string;
  action: string;
  remark: string;
  workDone: number; // 10 - 100
  status: TaskStatus;
  createdAt?: string;
}

export interface TaskAssignmentHistoryRecord {
  id?: string;
  _id?: string;
  taskId: string;
  previousEmployeeId?: string;
  newEmployeeId: string;
  assignedById: string;
  assignedByName?: string;
  date: string;
  reason?: string;
  createdAt?: string;
}

export interface Task {
  id?: string;
  _id?: string;
  title: string;
  description: string;
  projectId: string;
  projectName?: string;
  priority: TaskPriority;
  status: TaskStatus;
  assignedById: string;
  assignedByName?: string;
  assignedEmployeeIds: string[];
  assignedEmployeeNames?: string[];
  projectHeadId?: string;
  workDone?: number; // 0 - 100
  reminderDate?: string;
  reminderInterval?: string;
  completionRequestedDate?: string;
  approvedBy?: string;
  approvalDate?: string;
  approvalRemarks?: string;
  flagStatus?: 'Open' | 'Resolved' | 'None';
  flagMessage?: string;
  flagDate?: string;
  dueDate?: string;
  rating?: number; // Director only (1-5)
  privateComment?: string; // Director only
  createdAt?: string;
  updatedAt?: string;
}

export interface Reminder {
  id?: string;
  _id?: string;
  taskId: string;
  taskTitle?: string;
  employeeId: string;
  employeeName?: string;
  reminderDate: string; // YYYY-MM-DD
  message?: string;
  status: 'Pending' | 'Replied' | 'Not Replied';
  response?: string;
  responseDate?: string;
  createdAt?: string;
}

export interface FlagReply {
  id?: string;
  _id?: string;
  userId: string;
  userName: string;
  userRole: UserRole;
  message: string;
  createdAt: string;
}

export interface Flag {
  id?: string;
  _id?: string;
  taskId: string;
  taskTitle?: string;
  employeeId: string;
  employeeName?: string;
  createdBy?: string;
  createdByRole?: UserRole;
  flagType?: string; // Needs Input, Needs Attention, Progress Concern, Client Dependency, Technical Issue, Priority Change, On Track
  flagMessage: string;
  flagDate: string;
  status: 'Open' | 'Resolved';
  managementResponse?: string;
  replies?: FlagReply[];
  resolvedBy?: string;
  resolvedAt?: string;
  createdAt?: string;
}

export type NotificationType = 
  | 'TASK_ASSIGNED'
  | 'TASK_PROGRESS_UPDATED'
  | 'TASK_FLAGGED'
  | 'TASK_SUBMITTED_FOR_APPROVAL'
  | 'TASK_APPROVED'
  | 'TASK_REASSIGNED'
  | 'TASK_CARRIED_FORWARD'
  | 'EMPLOYEE_ABSENT'
  | 'REMINDER'
  | 'FLAG_REPLY'
  | 'RETURN_FOR_REVISION';

export interface Notification {
  id?: string;
  _id?: string;
  recipientUserId: string;
  type: NotificationType;
  title: string;
  message: string;
  taskId?: string;
  projectId?: string;
  relatedUserId?: string;
  relatedUserName?: string;
  previousWorkDone?: number;
  newWorkDone?: number;
  isRead: boolean;
  createdAt: string;
}

export interface Attendance {
  id?: string;
  _id?: string;
  employeeId: string;
  employeeName?: string;
  date: string; // YYYY-MM-DD
  status: EmployeeStatus;
  markedBy: string;
  actionTaken?: 'Carry Forward' | 'Reassign' | 'Keep On Hold';
  createdAt?: string;
}

export interface PrivateRating {
  id?: string;
  _id?: string;
  taskId: string;
  employeeId: string;
  directorId: string;
  rating: number; // 1-5
  privateComment?: string;
  createdAt?: string;
}

export interface EmployeePerformance {
  employeeId: string;
  employeeName: string;
  tasksAssigned: number;
  tasksCompleted: number;
  tasksPending: number;
  tasksOverdue: number;
  tasksCompletedOnTime: number;
  workDonePercentage: number;
  tasksCarriedForward: number;
  tasksReassigned: number;
  notUpdatedCount: number;
  notRepliedCount: number;
  absentDays: number;
  flaggedTasksCount: number;
  directorRating?: number;
  weekly?: {
    workDone: number;
    workHours: number;
    freeHours: number;
    marking: number;
  };
  monthly?: {
    workDone: number;
    workHours: number;
    freeHours: number;
    marking: number;
  };
}

export interface DashboardStats {
  currentProjects: number;
  upcomingProjects: number;
  sleepingProjects: number;
  completedProjects: number;
  currentTasks: number;
  pendingApprovalTasks: number;
  overdueTasks: number;
  flaggedTasks: number;
  activeEmployees: number;
  absentEmployees: number;
}

export interface DailyEntry {
  id?: string;
  _id?: string;
  employeeId: string;
  employeeName?: string;
  taskId: string;
  projectId: string;
  projectName?: string;
  taskTitle: string;
  details?: string;
  actionTaken: string;
  date: string; // YYYY-MM-DD
  hours: number;
  flagged: boolean;
  flagComment?: string;
  status: 'Pending' | 'In Progress' | 'Completed' | 'Blocked';
  createdAt?: string;
  updatedAt?: string;
}

export interface IndependentWork {
  id?: string;
  _id?: string;
  title: string;
  description?: string;
  employeeId?: string;
  date?: string;
  status?: string;
  createdAt?: string;
  updatedAt?: string;
}

