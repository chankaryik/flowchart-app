import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'

import type {
  AddCommentNode,
  DateTimeConnectorNode,
  DateTimeNode,
  FlowNode,
  SendMessageNode,
  TriggerNode,
} from '@/lib/types'
import { nodeKey, sameNodeId, useFlowStore } from '@/stores/flow'

function getName(node: FlowNode | undefined): string | undefined {
  return (node as { name?: string } | undefined)?.name
}

const trigger: TriggerNode = {
  id: 1,
  parentId: -1,
  type: 'trigger',
  data: { type: 'conversationOpened', oncePerContact: false },
}

const dateTime: DateTimeNode = {
  id: 'd0',
  parentId: 1,
  type: 'dateTime',
  name: 'Business Hours',
  data: {
    times: [{ day: 'mon', startTime: '09:00', endTime: '17:00' }],
    connectors: ['c-success', 'c-failure'],
    timezone: 'UTC',
    action: 'businessHours',
  },
}

const success: DateTimeConnectorNode = {
  id: 'c-success',
  parentId: 'd0',
  type: 'dateTimeConnector',
  name: 'Success',
  data: { connectorType: 'success' },
}

const failure: DateTimeConnectorNode = {
  id: 'c-failure',
  parentId: 'd0',
  type: 'dateTimeConnector',
  name: 'Failure',
  data: { connectorType: 'failure' },
}

const welcome: SendMessageNode = {
  id: 'msg-1',
  parentId: 'c-success',
  type: 'sendMessage',
  name: 'Welcome Message',
  data: { payload: [{ type: 'text', text: 'hi' }] },
}

const comment: AddCommentNode = {
  id: 'comment-1',
  parentId: 'msg-1',
  type: 'addComment',
  name: 'Comment',
  data: { comment: 'note' },
}

const SEED: FlowNode[] = [trigger, dateTime, success, failure, welcome, comment]

beforeEach(() => {
  setActivePinia(createPinia())
})

describe('helpers', () => {
  it('nodeKey stringifies ids', () => {
    expect(nodeKey(1)).toBe('1')
    expect(nodeKey('abc')).toBe('abc')
  })

  it('sameNodeId compares across string/number', () => {
    expect(sameNodeId(1, '1')).toBe(true)
    expect(sameNodeId('a', 'a')).toBe(true)
    expect(sameNodeId(1, 2)).toBe(false)
  })
})

describe('useFlowStore', () => {
  it('hydrate replaces nodes with shallow copies', () => {
    const store = useFlowStore()
    store.hydrate(SEED)
    expect(store.nodes).toHaveLength(SEED.length)
    expect(store.nodes[0]).not.toBe(SEED[0])
    expect(store.nodes[0]?.id).toBe(1)
  })

  it('getNodeById finds nodes regardless of id type', () => {
    const store = useFlowStore()
    store.hydrate(SEED)
    expect(store.getNodeById(1)?.type).toBe('trigger')
    expect(store.getNodeById('1')?.type).toBe('trigger')
    expect(getName(store.getNodeById('msg-1'))).toBe('Welcome Message')
  })

  it('getChildren returns direct children only', () => {
    const store = useFlowStore()
    store.hydrate(SEED)
    const children = store.getChildren('d0')
    expect(children.map((n) => n.id).sort()).toEqual(['c-failure', 'c-success'])
  })

  it('getDescendants includes the root and all transitive children', () => {
    const store = useFlowStore()
    store.hydrate(SEED)
    const subtree = store.getDescendants('d0')
    const ids = subtree.map((n) => n.id)
    expect(ids).toContain('d0')
    expect(ids).toContain('c-success')
    expect(ids).toContain('c-failure')
    expect(ids).toContain('msg-1')
    expect(ids).toContain('comment-1')
    expect(ids).not.toContain(1)
  })

  it('applyPatch merges into the matching node', () => {
    const store = useFlowStore()
    store.hydrate(SEED)
    store.applyPatch('msg-1', { name: 'Renamed' } as Partial<FlowNode>)
    expect(getName(store.getNodeById('msg-1'))).toBe('Renamed')
  })

  it('applyPatch is a no-op for unknown ids', () => {
    const store = useFlowStore()
    store.hydrate(SEED)
    const before = JSON.stringify(store.nodes)
    store.applyPatch('does-not-exist', { name: 'x' } as Partial<FlowNode>)
    expect(JSON.stringify(store.nodes)).toBe(before)
  })

  it('removeNodes drops nodes and clears their positions', () => {
    const store = useFlowStore()
    store.hydrate(SEED)
    store.setPosition('msg-1', { x: 10, y: 20 })
    store.removeNodes(['msg-1', 'comment-1'])
    expect(store.getNodeById('msg-1')).toBeUndefined()
    expect(store.getNodeById('comment-1')).toBeUndefined()
    expect(store.positions['msg-1']).toBeUndefined()
  })

  it('setPosition writes to the positions map keyed by stringified id', () => {
    const store = useFlowStore()
    store.hydrate([trigger])
    store.setPosition(1, { x: 1, y: 2 })
    expect(store.positions['1']).toEqual({ x: 1, y: 2 })
  })

  it('addNodes restores nodes and positions (undo-of-delete scenario)', () => {
    const store = useFlowStore()
    store.hydrate(SEED)
    const subtree = store.getDescendants('msg-1').map((n) => ({ ...n }))
    const positions = { 'msg-1': { x: 11, y: 22 } }
    store.setPosition('msg-1', positions['msg-1'])
    const ids = subtree.map((n) => n.id)
    store.removeNodes(ids)
    expect(store.getNodeById('msg-1')).toBeUndefined()
    store.addNodes(subtree, positions)
    expect(getName(store.getNodeById('msg-1'))).toBe('Welcome Message')
    expect(store.positions['msg-1']).toEqual({ x: 11, y: 22 })
  })

  describe('createDialog UI state', () => {
    it('starts closed with no preset parent', () => {
      const store = useFlowStore()
      expect(store.createDialog).toEqual({ open: false, parentId: null })
    })

    it('openCreateDialog() with no arg opens the dialog without a preset parent', () => {
      const store = useFlowStore()
      store.openCreateDialog()
      expect(store.createDialog).toEqual({ open: true, parentId: null })
    })

    it('openCreateDialog(id) opens the dialog with the preset parent', () => {
      const store = useFlowStore()
      store.openCreateDialog('msg-1')
      expect(store.createDialog).toEqual({ open: true, parentId: 'msg-1' })
    })

    it('closeCreateDialog resets both fields so a re-open after a plus-button click starts clean', () => {
      const store = useFlowStore()
      store.openCreateDialog('msg-1')
      store.closeCreateDialog()
      expect(store.createDialog).toEqual({ open: false, parentId: null })
    })
  })
})
