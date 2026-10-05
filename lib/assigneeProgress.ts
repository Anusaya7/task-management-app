export type AssigneeStatus =
  | 'Pending'
  | 'In Progress'
  | 'Pending Approval'
  | 'Completed'
  | 'Carried Forward'
  | 'Reassigned'
  | 'Not Updated'
  | 'Not Replied'
  | 'Revision Required'

export interface AssigneeProgressItem {
  employeeId: string
  employeeName?: string
  status: AssigneeStatus
  workDone: number
  lastSubmittedAt?: Date
}

export function ensureAssigneeProgress(
  assignedEmployeeIds: string[] = [],
  assignedEmployeeNames: string[] = [],
  existing: AssigneeProgressItem[] = [],
  fallbackStatus: AssigneeStatus = 'Pending',
  fallbackWorkDone = 0
): AssigneeProgressItem[] {
  const previous = new Map(
    (existing || [])
      .filter(item => item && item.employeeId)
      .map(item => [item.employeeId, item])
  )

  return assignedEmployeeIds.map((employeeId, index) => {
    const prior = previous.get(employeeId)
    return {
      employeeId,
      employeeName: prior?.employeeName || assignedEmployeeNames[index] || 'Employee',
      status: prior?.status || fallbackStatus,
      workDone: typeof prior?.workDone === 'number' ? prior.workDone : fallbackWorkDone,
      lastSubmittedAt: prior?.lastSubmittedAt ? new Date(prior.lastSubmittedAt) : undefined
    }
  })
}

export function applyEmployeeSubmission(
  progress: AssigneeProgressItem[],
  employeeId: string,
  employeeName: string,
  workDone: number
): AssigneeProgressItem[] {
  const next = [...progress]
  const index = next.findIndex(item => item.employeeId === employeeId)
  const clamped = Math.max(0, Math.min(100, Number(workDone) || 0))
  const status: AssigneeStatus = clamped >= 100 ? 'Pending Approval' : clamped > 0 ? 'In Progress' : 'Pending'
  const updated: AssigneeProgressItem = {
    employeeId,
    employeeName: employeeName || next[index]?.employeeName || 'Employee',
    status: next[index]?.status === 'Completed' && clamped >= 100 ? 'Completed' : status,
    workDone: clamped,
    lastSubmittedAt: new Date()
  }

  if (index >= 0) {
    next[index] = updated
  } else {
    next.push(updated)
  }
  return next
}

export function aggregateAssigneeProgress(progress: AssigneeProgressItem[], currentStatus?: string) {
  if (currentStatus === 'Completed') {
    return {
      status: 'Completed' as AssigneeStatus,
      workDone: 100
    }
  }

  if (!progress || progress.length === 0) {
    return {
      status: (currentStatus as AssigneeStatus) || 'Pending',
      workDone: 0
    }
  }

  const workDone = Math.round(progress.reduce((sum, item) => sum + (Number(item.workDone) || 0), 0) / progress.length)
  const allCompleted = progress.every(item => item.status === 'Completed' || item.workDone >= 100)
  const anyPendingApproval = progress.some(item => item.status === 'Pending Approval' || item.workDone >= 100)
  const anyStarted = progress.some(item => (item.workDone || 0) > 0 || item.status === 'In Progress')

  if (allCompleted && progress.every(item => item.status === 'Completed')) {
    return { status: 'Completed' as AssigneeStatus, workDone }
  }
  if (progress.every(item => item.workDone >= 100)) {
    return { status: 'Pending Approval' as AssigneeStatus, workDone: 100 }
  }
  if (anyPendingApproval && !anyStarted) {
    return { status: 'Pending Approval' as AssigneeStatus, workDone }
  }
  if (anyStarted) {
    return { status: 'In Progress' as AssigneeStatus, workDone }
  }
  return { status: 'Pending' as AssigneeStatus, workDone }
}

export function serializeTaskWithAssignees(task: any) {
  const obj = task && typeof task.toObject === 'function' ? task.toObject() : { ...(task || {}) }
  const assignedEmployeeIds: string[] = obj.assignedEmployeeIds || []
  const assignedEmployeeNames: string[] = obj.assignedEmployeeNames || []
  obj.assigneeProgress = ensureAssigneeProgress(
    assignedEmployeeIds,
    assignedEmployeeNames,
    obj.assigneeProgress || [],
    obj.status || 'Pending',
    assignedEmployeeIds.length <= 1 ? (obj.workDone || 0) : 0
  )
  if (obj._id && !obj.id) obj.id = obj._id.toString()
  return obj
}
