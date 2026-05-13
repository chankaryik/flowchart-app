import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import type { FlowNode, NodeId } from '@/lib/types'

export type Position = { x: number; y: number }

export function nodeKey(id: NodeId): string {
  return String(id)
}

export function sameNodeId(a: NodeId, b: NodeId): boolean {
  return String(a) === String(b)
}

export type CreateDialogState = {
  open: boolean
  // When set, the create dialog skips the parent step and locks the new
  // node's parent to this id (plus-button-on-node flow). When null and
  // open is true, the dialog runs its full 3-step picker (header button flow).
  parentId: NodeId | null
}

export const useFlowStore = defineStore('flow', () => {
  const nodes = ref<FlowNode[]>([])
  const positions = ref<Record<string, Position>>({})
  const selectedId = ref<NodeId | null>(null)
  const draggingId = ref<NodeId | null>(null)
  const createDialog = ref<CreateDialogState>({ open: false, parentId: null })

  const nodesById = computed(() => {
    const map = new Map<string, FlowNode>()
    for (const node of nodes.value) {
      map.set(nodeKey(node.id), node)
    }
    return map
  })

  function getNodeById(id: NodeId): FlowNode | undefined {
    return nodesById.value.get(nodeKey(id))
  }

  function getChildren(parentId: NodeId): FlowNode[] {
    return nodes.value.filter((node) => sameNodeId(node.parentId, parentId))
  }

  function getDescendants(rootId: NodeId): FlowNode[] {
    const root = getNodeById(rootId)
    if (root == null) return []

    const out: FlowNode[] = [root]
    const queue: NodeId[] = [rootId]
    while (queue.length > 0) {
      const current = queue.shift()
      if (current == null) continue
      for (const child of getChildren(current)) {
        out.push(child)
        queue.push(child.id)
      }
    }
    return out
  }

  function hydrate(seed: FlowNode[]): void {
    nodes.value = seed.map((node) => ({ ...node }))
  }

  function addNode(node: FlowNode, position?: Position): void {
    nodes.value.push(node)
    if (position != null) {
      positions.value[nodeKey(node.id)] = position
    }
  }

  function addNodes(toAdd: FlowNode[], positionMap?: Record<string, Position>): void {
    for (const node of toAdd) {
      nodes.value.push(node)
    }
    if (positionMap != null) {
      for (const [key, value] of Object.entries(positionMap)) {
        positions.value[key] = value
      }
    }
  }

  function applyPatch(id: NodeId, patch: Record<string, unknown>): void {
    const index = nodes.value.findIndex((node) => sameNodeId(node.id, id))
    if (index < 0) return
    const current = nodes.value[index]
    if (current == null) return
    nodes.value[index] = { ...current, ...patch } as FlowNode
  }

  function removeNodes(ids: NodeId[]): void {
    const removeSet = new Set(ids.map(nodeKey))
    nodes.value = nodes.value.filter((node) => !removeSet.has(nodeKey(node.id)))
    for (const key of removeSet) {
      delete positions.value[key]
    }
    if (selectedId.value != null && removeSet.has(nodeKey(selectedId.value))) {
      selectedId.value = null
    }
    if (draggingId.value != null && removeSet.has(nodeKey(draggingId.value))) {
      draggingId.value = null
    }
  }

  function setPosition(id: NodeId, xy: Position): void {
    positions.value[nodeKey(id)] = xy
  }

  function setPositions(map: Record<string, Position>): void {
    for (const [key, value] of Object.entries(map)) {
      positions.value[key] = value
    }
  }

  function clearPositions(): void {
    positions.value = {}
  }

  function setSelection(id: NodeId | null): void {
    selectedId.value = id
  }

  function setDragging(id: NodeId | null): void {
    draggingId.value = id
  }

  function openCreateDialog(parentId?: NodeId | null): void {
    createDialog.value = { open: true, parentId: parentId ?? null }
  }

  function closeCreateDialog(): void {
    createDialog.value = { open: false, parentId: null }
  }

  return {
    nodes,
    positions,
    selectedId,
    draggingId,
    createDialog,
    getNodeById,
    getChildren,
    getDescendants,
    hydrate,
    addNode,
    addNodes,
    applyPatch,
    removeNodes,
    setPosition,
    setPositions,
    clearPositions,
    setSelection,
    setDragging,
    openCreateDialog,
    closeCreateDialog,
  }
})
