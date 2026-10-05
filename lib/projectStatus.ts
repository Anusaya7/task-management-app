export const PROJECT_STATUS_VALUES = ['Ongoing', 'Upcoming', 'Sleeping (On Hold)', 'Completed'] as const

export type DisplayProjectStatus = (typeof PROJECT_STATUS_VALUES)[number]

export function normalizeProjectStatus(status?: string | null): DisplayProjectStatus {
  if (status === 'Upcoming' || status === 'Sleeping (On Hold)' || status === 'Completed' || status === 'Ongoing') {
    return status
  }
  return 'Ongoing'
}

export function persistProjectStatus(status?: string | null): DisplayProjectStatus {
  return normalizeProjectStatus(status)
}

export function isOngoingProjectStatus(status?: string | null): boolean {
  return status === 'Current' || status === 'Ongoing' || !status
}

export function serializeProject(doc: any) {
  const obj = doc && typeof doc.toObject === 'function' ? doc.toObject() : { ...(doc || {}) }
  obj.status = normalizeProjectStatus(obj.status)
  if (obj._id && !obj.id) obj.id = obj._id.toString()
  return obj
}
