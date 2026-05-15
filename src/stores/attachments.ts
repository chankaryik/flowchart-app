import { defineStore } from 'pinia'
import { reactive } from 'vue'

import type { NodeId } from '@/lib/types'

// In-memory map of uploaded File arrays, keyed by "<nodeId>:<payloadIndex>".
// Files can never be serialized to localStorage, so they live here only — the
// payload itself just stores filename strings.
function makeKey(nodeId: NodeId, index: number): string {
  return `${nodeId}:${index}`
}

export const useAttachmentsStore = defineStore('attachments', () => {
  // Entries may be `undefined` to preserve index alignment with the row's
  // names array when some names (e.g. seed URLs) have no backing File.
  const files = reactive(new Map<string, (File | undefined)[]>())

  function get(nodeId: NodeId, index: number): (File | undefined)[] {
    return files.get(makeKey(nodeId, index)) ?? []
  }

  function commit(
    nodeId: NodeId,
    entries: ReadonlyMap<number, (File | undefined)[]>,
  ): void {
    // Replace this node's entries wholesale so the saved indices stay in sync
    // with the canonical payload array order.
    const prefix = `${nodeId}:`
    for (const key of Array.from(files.keys())) {
      if (key.startsWith(prefix)) files.delete(key)
    }
    for (const [index, list] of entries) {
      if (list.some((f) => f != null)) files.set(makeKey(nodeId, index), list.slice())
    }
  }

  function clearNode(nodeId: NodeId): void {
    const prefix = `${nodeId}:`
    for (const key of Array.from(files.keys())) {
      if (key.startsWith(prefix)) files.delete(key)
    }
  }

  return { get, commit, clearNode }
})
