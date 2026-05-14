import { useMutation, useQuery } from '@tanstack/vue-query'
import { watch } from 'vue'
import { toast } from 'vue-sonner'

import { loadNodes, loadPositions, saveNodes } from '@/lib/payload-adapter'
import type { FlowNode, NodeId } from '@/lib/types'
import { NODES_QUERY_KEY } from '@/queries/client'
import { type Position, nodeKey, useFlowStore } from '@/stores/flow'
import { useHistoryStore } from '@/stores/history'

export type CreateNodeVars = {
  nodes: FlowNode[]
  position?: Position
  positions?: Record<string, Position>
}

export type UpdateNodeVars = {
  id: NodeId
  patch: Partial<FlowNode>
}

export type DeleteNodeVars = {
  id: NodeId
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
      if (data != null) {
        store.hydrate(data)
        store.clearPositions()
        store.setPositions(loadPositions())
      }
    },
    { immediate: true },
  )
  return query
}

function describeError(error: unknown): string | undefined {
  return error instanceof Error ? error.message : undefined
}

function clonePositions(positions: Record<string, Position>): Record<string, Position> {
  const snapshot: Record<string, Position> = {}
  for (const [key, value] of Object.entries(positions)) {
    snapshot[key] = { x: value.x, y: value.y }
  }
  return snapshot
}

function persistFlow(store: ReturnType<typeof useFlowStore>): Promise<void> {
  return saveNodes([...store.nodes], clonePositions(store.positions))
}

function persistFlowInBackground(store: ReturnType<typeof useFlowStore>): void {
  void persistFlow(store).catch(() => undefined)
}

export function useCreateNode() {
  const store = useFlowStore()
  const history = useHistoryStore()

  return useMutation({
    mutationFn: () => persistFlow(store),
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
        label: `Create ${primary.type}`,
        undo: () => {
          store.removeNodes(snapshot.map((n) => n.id))
          persistFlowInBackground(store)
        },
        redo: () => {
          store.addNodes(snapshot, positionMap)
          persistFlowInBackground(store)
        },
      })
    },
    onError: (error) => {
      const cmd = history.popLast()
      cmd?.undo()
      toast.error('Failed to create node', { description: describeError(error) })
    },
  })
}

export function useUpdateNode() {
  const store = useFlowStore()
  const history = useHistoryStore()

  return useMutation({
    mutationFn: () => persistFlow(store),
    onMutate: (vars: UpdateNodeVars) => {
      const before = store.getNodeById(vars.id)
      if (before == null) return
      const beforeSnap = { ...before } as Record<string, unknown>
      store.applyPatch(vars.id, vars.patch as Record<string, unknown>)
      const afterSnap = store.getNodeById(vars.id)
      if (afterSnap == null) return
      const afterCopy = { ...afterSnap } as Record<string, unknown>
      history.push({
        label: `Update ${before.type}`,
        undo: () => {
          store.applyPatch(vars.id, beforeSnap)
          persistFlowInBackground(store)
        },
        redo: () => {
          store.applyPatch(vars.id, afterCopy)
          persistFlowInBackground(store)
        },
      })
    },
    onError: (error) => {
      const cmd = history.popLast()
      cmd?.undo()
      toast.error('Failed to save changes', { description: describeError(error) })
    },
  })
}

export function useDeleteNode() {
  const store = useFlowStore()
  const history = useHistoryStore()

  return useMutation({
    mutationFn: () => persistFlow(store),
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
        label: `Delete ${root?.type ?? 'node'}`,
        undo: () => {
          store.addNodes(snapshotNodes, snapshotPositions)
          persistFlowInBackground(store)
        },
        redo: () => {
          store.removeNodes(ids)
          persistFlowInBackground(store)
        },
      })
    },
    onError: (error) => {
      const cmd = history.popLast()
      cmd?.undo()
      toast.error('Failed to delete node', { description: describeError(error) })
    },
  })
}

export function useMoveNode() {
  const store = useFlowStore()
  const history = useHistoryStore()

  return useMutation({
    mutationFn: () => persistFlow(store),
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
        label: `Move ${node?.type ?? 'node'}`,
        undo: () => {
          if (previous != null) {
            store.setPosition(vars.id, previous)
          } else {
            delete store.positions[key]
          }
          for (const move of secondary) {
            store.setPosition(move.id, move.from)
          }
          persistFlowInBackground(store)
        },
        redo: () => {
          store.setPosition(vars.id, next)
          for (const move of secondary) {
            store.setPosition(move.id, move.to)
          }
          persistFlowInBackground(store)
        },
      })
    },
    onError: (error) => {
      const cmd = history.popLast()
      cmd?.undo()
      toast.error('Failed to move node', { description: describeError(error) })
    },
  })
}
