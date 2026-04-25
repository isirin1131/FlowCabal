import type { Workspace } from '@flowcabal/engine'

export function workspaceToRecord(ws: Workspace) {
  return {
    ...ws,
    outputs: Object.fromEntries(ws.outputs),
    upstream: Object.fromEntries(ws.upstream),
    downstream: Object.fromEntries(ws.downstream),
  }
}

export function recordToWorkspace(data: any): Workspace {
  return {
    ...data,
    outputs: new Map(Object.entries(data.outputs ?? {})),
    upstream: new Map(Object.entries(data.upstream ?? {})),
    downstream: new Map(Object.entries(data.downstream ?? {})),
  }
}
