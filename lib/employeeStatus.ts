export type EmployeeAccountStatus = 'Active' | 'Absent' | 'Inactive'

const EMPLOYEE_ACCOUNT_STATUSES: EmployeeAccountStatus[] = ['Active', 'Absent', 'Inactive']

export function parseEmployeeStatus(value: unknown): EmployeeAccountStatus | null {
  if (typeof value !== 'string') return null
  const normalized = value.trim().toLowerCase()
  return EMPLOYEE_ACCOUNT_STATUSES.find(status => status.toLowerCase() === normalized) || null
}

export function normalizeEmployeeStatus(value: unknown): EmployeeAccountStatus {
  if (value === null || value === undefined || (typeof value === 'string' && value.trim() === '')) {
    return 'Active'
  }
  return parseEmployeeStatus(value) || 'Inactive'
}

export function isInactiveEmployee(value: unknown): boolean {
  return normalizeEmployeeStatus(value) === 'Inactive'
}

export function isDirectorRole(value: unknown): boolean {
  return typeof value === 'string' && value.trim().toLowerCase() === 'director'
}

export function canAccountLogin(role: unknown, status: unknown): boolean {
  // Director must always be able to sign in, otherwise the org cannot reactivate anyone.
  if (isDirectorRole(role)) return true
  return !isInactiveEmployee(status)
}
