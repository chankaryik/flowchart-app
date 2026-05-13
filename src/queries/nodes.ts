import { useMutation, useQuery } from '@tanstack/vue-query'
import { watch } from 'vue'
import { toast } from 'vue-sonner'

import { loadNodes, saveNodes } from '@/lib/payload-adapter'
import type { FlowNode, NodeId } from '@/lib/types'
import { NODES_QUERY_KEY } from '@/queries/client'
import { type Position, nodeKey, useFlowStore } from '@/stores/flow'
import { useHistoryStore } from '@/stores/history'

export type CreateNodeVars = {
  nodes: FlowNode[]
  position?: Position
  positions?: Record<string, Position>
  label?: string
  silent?: boolean
}

export type UpdateNodeVars = {
  id: NodeId
  patch: Partial<FlowNode>
  label?: string
  silent?: boolean
}

export type DeleteNodeVars = {
  id: NodeId
  label?: string
  silent?: boolean
}

export type SecondaryMove = {
  id: NodeId
  from: Position
  to: Position
}

export type MoveNodeVars = {
  id: NodeId
  position: Position
  previousPosition?: Position
  // Additional nodes that moved alongside the primary in the same gesture
  // (e.g. dateTimeConnector children dragged with their dateTime parent).
  // Bundled into one history entry so undo restores them together.
  secondary?: SecondaryMove[]
  label?: string
  silent?: boolean
}

export function useNodesQuery() {
  const store = useFlowStore()
  const query = useQuery({
    queryKey: NODES_QUERY_KEY,
    queryFn: loadNodes,
  })
  watch(
    query.data,
    (data) => {
      if (data != null) store.hydrate(data)
    },
    { immediate: true },
  )
  return query
}

// Mutations write through the mutationFn; undo/redo run outside that lifecycle
// and would otherwise leave localStorage holding the post-mutation state — a
// refresh after an undo would restore what the user just reverted. Wrap each
// history callback so the store change is persisted at the same boundary.
function persistAfter(
  store: ReturnType<typeof useFlowStore>,
  fn: () => void,
): () => void {
  return () => {
    fn()
    void saveNodes([...store.nodes])
  }
}

function toastError(
  vars: { label?: string; silent?: boolean } | undefined,
  fallback: string,
  error: unknown,
): void {
  if (vars?.silent) return
  const description = error instanceof Error ? error.message : undefined
  toast.error(vars?.label ?? fallback, { description })
}

export function useCreateNode() {
  const store = useFlowStore()
  const history = useHistoryStore()

  return useMutation({
    mutationFn: () => saveNodes([...store.nodes]),
    onMutate: (vars: CreateNodeVars) => {
      const primary = vars.nodes[0]
      if (primary == null) return
      let positionMap: Record<string, Position> | undefined
      if (vars.positions != null) {
        positionMap = vars.positions
      } else if (vars.position != null) {
        positionMap = { [nodeKey(primary.id)]: vars.position }
      }
      const snapshot = vars.nodes.map((node) => ({ ...node }))
      store.addNodes(snapshot, positionMap)
      history.push({
        label: vars.label ?? `Create ${primary.type}`,
        undo: persistAfter(store, () => store.removeNodes(snapshot.map((n) => n.id))),
        redo: persistAfter(store, () => store.addNodes(snapshot, positionMap)),
      })
    },
    onError: (error, vars) => {
      const cmd = history.popLast()
      cmd?.undo()
      toastError(vars, 'Failed to create node', error)
    },
  })
}

export function useUpdateNode() {
  const store = useFlowStore()
  const history = useHistoryStore()

  return useMutation({
    mutationFn: () => saveNodes([...store.nodes]),
    onMutate: (vars: UpdateNodeVars) => {
      const before = store.getNodeById(vars.id)
      if (before == null) return
      const beforeSnap = { ...before } as Record<string, unknown>
      store.applyPatch(vars.id, vars.patch as Record<string, unknown>)
      const afterSnap = store.getNodeById(vars.id)
      if (afterSnap == null) return
      const afterCopy = { ...afterSnap } as Record<string, unknown>
      history.push({
        label: vars.label ?? `Update ${before.type}`,
        undo: persistAfter(store, () => store.applyPatch(vars.id, beforeSnap)),
        redo: persistAfter(store, () => store.applyPatch(vars.id, afterCopy)),
      })
    },
    onError: (error, vars) => {
      const cmd = history.popLast()
      cmd?.undo()
      toastError(vars, 'Failed to save changes', error)
    },
  })
}

export function useDeleteNode() {
  const store = useFlowStore()
  const history = useHistoryStore()

  return useMutation({
    mutationFn: () => saveNodes([...store.nodes]),
    onMutate: (vars: DeleteNodeVars) => {
      const subtree = store.getDescendants(vars.id)
      if (subtree.length === 0) return
      const snapshotNodes = subtree.map((n) => ({ ...n }))
      const snapshotPositions: Record<string, Position> = {}
      for (const node of subtree) {
        const key = nodeKey(node.id)
        const pos = store.positions[key]
        if (pos != null) snapshotPositions[key] = { ...pos }
      }
      const ids = snapshotNodes.map((n) => n.id)
      store.removeNodes(ids)
      const root = snapshotNodes[0]
      history.push({
        label: vars.label ?? `Delete ${root?.type ?? 'node'}`,
        undo: persistAfter(store, () => store.addNodes(snapshotNodes, snapshotPositions)),
        redo: persistAfter(store, () => store.removeNodes(ids)),
      })
    },
    onError: (error, vars) => {
      const cmd = history.popLast()
      cmd?.undo()
      toastError(vars, 'Failed to delete node', error)
    },
  })
}

export function useMoveNode() {
  const store = useFlowStore()
  const history = useHistoryStore()

  return useMutation({
    mutationFn: () => saveNodes([...store.nodes]),
    onMutate: (vars: MoveNodeVars) => {
      const key = nodeKey(vars.id)
      const previous = vars.previousPosition ?? store.positions[key]
      const next = vars.position
      store.setPosition(vars.id, next)
      const secondary = vars.secondary ?? []
      for (const move of secondary) {
        store.setPosition(move.id, move.to)
      }
      const node = store.getNodeById(vars.id)
      history.push({
        label: vars.label ?? `Move ${node?.type ?? 'node'}`,
        undo: persistAfter(store, () => {
          if (previous != null) {
            store.setPosition(vars.id, previous)
          } else {
            delete store.positions[key]
          }
          for (const move of secondary) {
            store.setPosition(move.id, move.from)
          }
        }),
        redo: persistAfter(store, () => {
          store.setPosition(vars.id, next)
          for (const move of secondary) {
            store.setPosition(move.id, move.to)
          }
        }),
      })
    },
    onError: (error, vars) => {
      const cmd = history.popLast()
      cmd?.undo()
      toastError(vars, 'Failed to move node', error)
    },
  })
}
