export function taskRecordId(task: { id?: string; _id?: string } | null | undefined) {
  return String(task?.id || task?._id || '')
}

export type NestedContextParent<T> = {
  key: string
  title: string
  children: T[]
}

export type NestedBoardItem<T extends {
  taskId: string
  parentTaskId?: string
  parentTaskTitle?: string
  projectId: string
  projectName: string
  hours?: number
}> = {
  projectId: string
  projectName: string
  hours: number
  roots: T[]
  childrenByParent: Map<string, T[]>
  contextParents: NestedContextParent<T>[]
}

export type ProjectTaskGroup<T> = {
  projectId: string
  projectName: string
  hours: number
  items: T[]
}

export function groupItemsByProject<T extends {
  projectId?: string
  projectName?: string
  hours?: number
}>(items: T[]): ProjectTaskGroup<T>[] {
  const byProject = new Map<string, { projectId: string; projectName: string; items: T[] }>()

  for (const item of items) {
    const rawId = String(item.projectId || '').trim()
    const name = String(item.projectName || '').trim() || 'Project'
    const key = rawId && rawId !== 'undefined' && rawId !== 'null'
      ? `id:${rawId}`
      : `name:${name.toLowerCase()}`

    const existing = byProject.get(key)
    if (existing) {
      existing.items.push(item)
      if (existing.projectName === 'Project' && name !== 'Project') {
        existing.projectName = name
      }
    } else {
      byProject.set(key, {
        projectId: rawId || key,
        projectName: name,
        items: [item]
      })
    }
  }

  return Array.from(byProject.values()).map(group => ({
    projectId: group.projectId,
    projectName: group.projectName,
    hours: group.items.reduce((sum, item) => sum + (Number(item.hours) || 0), 0),
    items: group.items
  }))
}

export function orderMainTasksFirst<T>(
  items: T[],
  getId: (item: T) => string,
  getParentId: (item: T) => string | undefined
): T[] {
  const ids = new Set(items.map(item => getId(item)).filter(Boolean))
  const childrenByParent = new Map<string, T[]>()
  const topLevel: T[] = []

  for (const item of items) {
    const id = getId(item)
    const parentId = String(getParentId(item) || '')
    if (parentId && parentId !== id && ids.has(parentId)) {
      const list = childrenByParent.get(parentId) || []
      list.push(item)
      childrenByParent.set(parentId, list)
    } else {
      topLevel.push(item)
    }
  }

  const hasChildren = (item: T) => childrenByParent.has(getId(item))
  const ordered: T[] = []
  for (const item of [...topLevel.filter(hasChildren), ...topLevel.filter(item => !hasChildren(item))]) {
    ordered.push(item, ...(childrenByParent.get(getId(item)) || []))
  }
  return ordered
}

export function nestItemsByProject<T extends {
  taskId: string
  parentTaskId?: string
  parentTaskTitle?: string
  projectId: string
  projectName: string
  hours?: number
}>(items: T[]): NestedBoardItem<T>[] {
  const byProject = new Map<string, { projectId: string; projectName: string; items: T[] }>()

  for (const item of items) {
    const projectId = String(item.projectId || 'none')
    const existing = byProject.get(projectId)
    if (existing) {
      existing.items.push(item)
    } else {
      byProject.set(projectId, {
        projectId,
        projectName: item.projectName || 'Project',
        items: [item]
      })
    }
  }

  return Array.from(byProject.values()).map(group => {
    const onBoard = new Set(group.items.map(item => item.taskId))
    const childrenByParent = new Map<string, T[]>()
    const contextMap = new Map<string, { title: string; children: T[] }>()
    const roots: T[] = []

    for (const item of group.items) {
      const parentId = item.parentTaskId ? String(item.parentTaskId) : ''
      if (parentId && onBoard.has(parentId) && parentId !== item.taskId) {
        const list = childrenByParent.get(parentId) || []
        list.push(item)
        childrenByParent.set(parentId, list)
      } else if (parentId || item.parentTaskTitle) {
        const key = parentId || String(item.parentTaskTitle)
        const existing = contextMap.get(key)
        if (existing) {
          existing.children.push(item)
        } else {
          contextMap.set(key, {
            title: item.parentTaskTitle || 'Parent task',
            children: [item]
          })
        }
      } else {
        roots.push(item)
      }
    }

    const hours = group.items.reduce((sum, item) => sum + (Number(item.hours) || 0), 0)
    return {
      projectId: group.projectId,
      projectName: group.projectName,
      hours,
      roots,
      childrenByParent,
      contextParents: Array.from(contextMap.entries()).map(([key, value]) => ({
        key,
        title: value.title,
        children: value.children
      }))
    }
  })
}
