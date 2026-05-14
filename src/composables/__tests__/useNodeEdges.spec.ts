import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'

import { useNodeEdges } from '@/composables/useNodeEdges'
import type { FlowNode } from '@/lib/types'
import { useFlowStore } from '@/stores/flow'

function seed(): FlowNode[] {
  return [
    { id: 1, parentId: -1, type: 'trigger', data: { type: 'x', oncePerContact: false } },
    {
      id: 'dt',
      parentId: 1,
      type: 'dateTime',
      name: 'dt',
      data: { times: [], connectors: ['ok', 'no'], timezone: 'UTC', action: 'businessHours' },
    },
    {
      id: 'ok',
      parentId: 'dt',
      type: 'dateTimeConnector',
      name: 'ok',
      data: { connectorType: 'success' },
    },
    {
      id: 'no',
      parentId: 'dt',
      type: 'dateTimeConnector',
      name: 'no',
      data: { connectorType: 'failure' },
    },
    { id: 'm1', parentId: 'ok', type: 'sendMessage', name: 'm1', data: { payload: [] } },
  ]
}

describe('useNodeEdges', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('emits one smoothstep edge per non-root parent→child link', () => {
    const store = useFlowStore()
    store.hydrate(seed())
    const edges = useNodeEdges()
    expect(edges.value).toHaveLength(4)
    for (const edge of edges.value) {
      expect(edge.type).toBe('smoothstep')
    }
    const sourceTargets = edges.value.map((e) => `${e.source}->${e.target}`).sort()
    expect(sourceTargets).toEqual(['1->dt', 'dt->no', 'dt->ok', 'ok->m1'])
  })

  it('skips the trigger because its parentId is outside the node set', () => {
    const store = useFlowStore()
    store.hydrate([
      { id: 1, parentId: -1, type: 'trigger', data: { type: 'x', oncePerContact: false } },
    ])
    expect(useNodeEdges().value).toEqual([])
  })

  it('reacts when the store hydrates new nodes', () => {
    const store = useFlowStore()
    const edges = useNodeEdges()
    expect(edges.value).toEqual([])
    store.hydrate(seed())
    expect(edges.value).toHaveLength(4)
  })
})
