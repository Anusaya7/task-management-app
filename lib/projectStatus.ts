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
  const obj = doc && typeof doc.toObject === 'function'
    ? doc.toObject({ flattenObjectIds: true })
    : { ...(doc || {}) }
  obj.status = normalizeProjectStatus(obj.status)
  if (obj._id) {
    obj._id = String(obj._id)
    if (!obj.id) obj.id = obj._id
  }
  const remarks = Array.isArray(obj.projectRemarks) ? obj.projectRemarks : []
  obj.projectRemarks = remarks.map((remark: any) => {
    const plain = remark && typeof remark.toObject === 'function'
      ? remark.toObject({ flattenObjectIds: true })
      : { ...(remark || {}) }
    return {
      _id: plain._id ? String(plain._id) : undefined,
      date: plain.date || '',
      remark: plain.remark || '',
      createdBy: plain.createdBy || undefined
    }
  }).filter((remark: { remark: string }) => remark.remark.trim())
  return obj
}
