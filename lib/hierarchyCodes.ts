import Project from '@/models/Project'
import Task from '@/models/Task'

const PROJECT_CODE = /^P(\d+)$/i

const codeNumber = (code: string | undefined, pattern: RegExp) => {
  const match = String(code || '').match(pattern)
  return match ? Number(match[1]) : 0
}

/** Gives every project without a code the lowest free P-number (P1, P2, ...), oldest first. */
export async function ensureProjectCodes() {
  const missing = await Project.find({ $or: [{ projectCode: { $exists: false } }, { projectCode: '' }, { projectCode: null }] })
    .sort({ createdAt: 1, _id: 1 })
  if (missing.length === 0) return

  const coded = await Project.find({ projectCode: { $regex: PROJECT_CODE } }).select('projectCode').lean()
  const used = new Set(coded.map((item: any) => codeNumber(item.projectCode, PROJECT_CODE)))
  let next = 0
  for (const project of missing) {
    do { next += 1 } while (used.has(next))
    used.add(next)
    project.projectCode = `P${next}`
    await project.save()
  }
}

/**
 * Gives tasks codes inside their project: main tasks become P1-T1, P1-T2, ...
 * and subtasks become P1/T1/ST1, P1/T1/ST2, ... Existing valid codes are kept and
 * older P1/T1 and P1/T1/S1 codes are converted with the same numbers.
 */
export async function ensureTaskCodes(projectIds?: string[]) {
  await ensureProjectCodes()
  const needsCode = {
    $or: [
      { taskCode: { $exists: false } },
      { taskCode: '' },
      { taskCode: null },
      { taskCode: { $regex: /^P\d+\/T\d+(\/S\d+)?$/ } }
    ]
  }
  if (!projectIds || projectIds.length === 0) {
    const pending = await Task.find(needsCode).distinct('projectId')
    if (pending.length === 0) return
    projectIds = pending.map(String)
  }
  const projectQuery = { _id: { $in: projectIds } }
  const projects = await Project.find(projectQuery).select('_id projectCode').lean()

  for (const project of projects as any[]) {
    const projectId = String(project._id)
    const projectCode = String(project.projectCode || '')
    if (!projectCode) continue

    const tasks = await Task.find({ projectId }).sort({ createdAt: 1, _id: 1 })
    if (tasks.length === 0) continue
    const byId = new Map(tasks.map(task => [task._id.toString(), task]))
    const isSubtask = (task: any) => {
      const parentId = String(task.parentTaskId || '')
      return Boolean(parentId && parentId !== task._id.toString() && byId.has(parentId))
    }

    const mainPattern = new RegExp(`^${projectCode}-T(\\d+)$`)
    const legacyMainPattern = new RegExp(`^${projectCode}/T(\\d+)$`)
    const mains = tasks.filter(task => !isSubtask(task))
    const legacyMainNumber = (task: any) => codeNumber(task.taskCode, legacyMainPattern)
    let nextMain = mains.reduce(
      (max, task) => Math.max(max, codeNumber(task.taskCode, mainPattern), legacyMainNumber(task)),
      0
    )
    for (const task of mains) {
      if (mainPattern.test(String(task.taskCode || ''))) continue
      const legacy = legacyMainNumber(task)
      if (legacy) {
        task.taskCode = `${projectCode}-T${legacy}`
      } else {
        nextMain += 1
        task.taskCode = `${projectCode}-T${nextMain}`
      }
      await task.save()
    }

    for (const parent of mains) {
      const mainNumber = codeNumber(parent.taskCode, mainPattern)
      const subPrefix = `${projectCode}/T${mainNumber}`
      const subPattern = new RegExp(`^${subPrefix}/ST(\\d+)$`)
      const legacySubPattern = new RegExp(`^${subPrefix}/S(\\d+)$`)
      const children = tasks.filter(task => isSubtask(task) && String(task.parentTaskId) === parent._id.toString())
      const legacySubNumber = (task: any) => codeNumber(task.taskCode, legacySubPattern)
      let nextSub = children.reduce(
        (max, task) => Math.max(max, codeNumber(task.taskCode, subPattern), legacySubNumber(task)),
        0
      )
      for (const child of children) {
        if (subPattern.test(String(child.taskCode || ''))) continue
        const legacy = legacySubNumber(child)
        if (legacy) {
          child.taskCode = `${subPrefix}/ST${legacy}`
        } else {
          nextSub += 1
          child.taskCode = `${subPrefix}/ST${nextSub}`
        }
        await child.save()
      }
    }
  }
}
