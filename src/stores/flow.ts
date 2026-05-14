import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import { idKey, sameId, type FlowNode, type NodeId } from '@/lib/types'

export type Position = { x: number; y: number }

export const nodeKey = idKey
export const sameNodeId = sameId

export type CreateDialogState = {
  open: boolean
  // When set, the create dialog locks the new node's parent to this id
  // (plus-button-on-node flow). When null, the header button creates an
  // orphan node on the canvas.
  parentId: NodeId | null
}

export const useFlowStore = defineStore('flow', () => {
  const nodes = ref<FlowNode[]>([])
  const positions = ref<Record<string, Position>>({})
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

  function addNodes(toAdd: FlowNode[], positionMap?: Record<string, Position>): void {
    if (toAdd.length > 0) nodes.value.push(...toAdd)
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

  function openCreateDialog(parentId?: NodeId | null): void {
    createDialog.value = { open: true, parentId: parentId ?? null }
  }

  function closeCreateDialog(): void {
    createDialog.value = { open: false, parentId: null }
  }

  return {
    nodes,
    positions,
    createDialog,
    getNodeById,
    getChildren,
    getDescendants,
    hydrate,
    addNodes,
    applyPatch,
    removeNodes,
    setPosition,
    setPositions,
    clearPositions,
    openCreateDialog,
    closeCreateDialog,
  }
})
