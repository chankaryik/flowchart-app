import type { Edge } from '@vue-flow/core'
import { computed, type ComputedRef } from 'vue'

import { nodeKey, useFlowStore } from '@/stores/flow'

export function useNodeEdges(): ComputedRef<Edge[]> {
  const store = useFlowStore()
  return computed(() => {
    const ids = new Set(store.nodes.map((node) => nodeKey(node.id)))
    const edges: Edge[] = []
    for (const node of store.nodes) {
      const parentKey = nodeKey(node.parentId)
      // Trigger's synthetic parentId (-1) is not in the node set and produces no edge.
      if (!ids.has(parentKey)) continue
      const childKey = nodeKey(node.id)
      edges.push({
        id: `e-${parentKey}-${childKey}`,
        source: parentKey,
        target: childKey,
        type: 'smoothstep',
      })
    }
    return edges
  })
}
