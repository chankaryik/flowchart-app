import { VueQueryPlugin } from '@tanstack/vue-query'
import { createPinia, getActivePinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createApp, defineComponent, h, nextTick } from 'vue'

import type {
  AddCommentNode,
  DateTimeConnectorNode,
  DateTimeNode,
  FlowNode,
  SendMessageNode,
  TriggerNode,
} from '@/lib/types'
import { createQueryClient } from '@/queries/client'
import {
  useCreateNode,
  useDeleteNode,
  useMoveNode,
  useNodesQuery,
  useUpdateNode,
} from '@/queries/nodes'
import { useFlowStore } from '@/stores/flow'
import { useHistoryStore } from '@/stores/history'

function getName(node: FlowNode | undefined): string | undefined {
  return (node as { name?: string } | undefined)?.name
}

vi.mock('@/lib/payload-adapter', () => ({
  loadNodes: vi.fn<() => Promise<FlowNode[]>>(),
  saveNodes: vi.fn<(nodes: FlowNode[]) => Promise<void>>().mockResolvedValue(undefined),
  STORAGE_KEY: 'payload-v1',
  PAYLOAD_URL: '/payload.json',
}))

import { loadNodes, saveNodes } from '@/lib/payload-adapter'

const loadNodesMock = vi.mocked(loadNodes)
const saveNodesMock = vi.mocked(saveNodes)

const trigger: TriggerNode = {
  id: 1,
  parentId: -1,
  type: 'trigger',
  data: { type: 'conversationOpened', oncePerContact: false },
}

const dateTimeNode: DateTimeNode = {
  id: 'dt',
  parentId: 1,
  type: 'dateTime',
  name: 'BH',
  data: {
    times: [{ day: 'mon', startTime: '09:00', endTime: '17:00' }],
    connectors: ['s', 'f'],
    timezone: 'UTC',
    action: 'businessHours',
  },
}

const success: DateTimeConnectorNode = {
  id: 's',
  parentId: 'dt',
  type: 'dateTimeConnector',
  name: 'Success',
  data: { connectorType: 'success' },
}

const failure: DateTimeConnectorNode = {
  id: 'f',
  parentId: 'dt',
  type: 'dateTimeConnector',
  name: 'Failure',
  data: { connectorType: 'failure' },
}

const sendMessage: SendMessageNode = {
  id: 'msg',
  parentId: 's',
  type: 'sendMessage',
  name: 'Welcome',
  data: { payload: [{ type: 'text', text: 'hi' }] },
}

const comment: AddCommentNode = {
  id: 'cmt',
  parentId: 'msg',
  type: 'addComment',
  name: 'Note',
  data: { comment: 'first' },
}

const SEED: FlowNode[] = [trigger, dateTimeNode, success, failure, sendMessage, comment]

type Harness<T> = {
  result: T
  app: ReturnType<typeof createApp>
}

function withSetup<T>(composable: () => T): Harness<T> {
  let result!: T
  const Comp = defineComponent({
    setup() {
      result = composable()
      return () => h('div')
    },
  })
  const app = createApp(Comp)
  const pinia = getActivePinia()
  if (pinia == null) throw new Error('Pinia must be active before withSetup')
  app.use(pinia)
  app.use(VueQueryPlugin, { queryClient: createQueryClient() })
  app.mount(document.createElement('div'))
  return { result, app }
}

beforeEach(() => {
  setActivePinia(createPinia())
  loadNodesMock.mockReset()
  saveNodesMock.mockReset()
  saveNodesMock.mockResolvedValue(undefined)
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('useNodesQuery', () => {
  it('hydrates the flow store when the query resolves', async () => {
    loadNodesMock.mockResolvedValue(SEED)

    const { app } = withSetup(() => {
      useNodesQuery()
    })
    const store = useFlowStore()

    expect(store.nodes).toHaveLength(0)
    await vi.waitFor(() => {
      expect(store.nodes).toHaveLength(SEED.length)
    })

    app.unmount()
  })
})

describe('useCreateNode', () => {
  it('appends nodes, records a position, pushes history, and calls saveNodes', async () => {
    const store = useFlowStore()
    const history = useHistoryStore()
    store.hydrate([trigger])

    const { app, result: mutation } = withSetup(() => useCreateNode())
    const newNode: SendMessageNode = {
      id: 'new1',
      parentId: 1,
      type: 'sendMessage',
      name: 'New',
      data: { payload: [] },
    }
    await mutation.mutateAsync({ nodes: [newNode], position: { x: 5, y: 6 } })

    expect(store.getNodeById('new1')).toBeDefined()
    expect(store.positions['new1']).toEqual({ x: 5, y: 6 })
    expect(history.undoStack.length).toBe(1)
    expect(saveNodesMock).toHaveBeenCalledTimes(1)

    history.undo()
    expect(store.getNodeById('new1')).toBeUndefined()

    app.unmount()
  })
})

describe('useUpdateNode', () => {
  it('patches the node and undo restores the previous value', async () => {
    const { app, result: mutation } = withSetup(() => useUpdateNode())
    const store = useFlowStore()
    const history = useHistoryStore()
    store.hydrate(SEED)

    await mutation.mutateAsync({ id: 'msg', patch: { name: 'Renamed' } as Partial<FlowNode> })
    expect(getName(store.getNodeById('msg'))).toBe('Renamed')

    history.undo()
    expect(getName(store.getNodeById('msg'))).toBe('Welcome')

    history.redo()
    expect(getName(store.getNodeById('msg'))).toBe('Renamed')

    app.unmount()
  })
})

describe('useDeleteNode', () => {
  it('cascades the subtree and undo restores all nodes and positions', async () => {
    const { app, result: mutation } = withSetup(() => useDeleteNode())
    const store = useFlowStore()
    const history = useHistoryStore()
    store.hydrate(SEED)
    store.setPosition('msg', { x: 100, y: 200 })

    await mutation.mutateAsync({ id: 'msg' })
    expect(store.getNodeById('msg')).toBeUndefined()
    expect(store.getNodeById('cmt')).toBeUndefined()
    expect(store.positions['msg']).toBeUndefined()

    history.undo()
    expect(getName(store.getNodeById('msg'))).toBe('Welcome')
    expect(getName(store.getNodeById('cmt'))).toBe('Note')
    expect(store.positions['msg']).toEqual({ x: 100, y: 200 })

    app.unmount()
  })

  it('cascading delete of a dateTime removes both connectors and their descendants', async () => {
    const { app, result: mutation } = withSetup(() => useDeleteNode())
    const store = useFlowStore()
    store.hydrate(SEED)

    await mutation.mutateAsync({ id: 'dt' })
    expect(store.getNodeById('dt')).toBeUndefined()
    expect(store.getNodeById('s')).toBeUndefined()
    expect(store.getNodeById('f')).toBeUndefined()
    expect(store.getNodeById('msg')).toBeUndefined()
    expect(store.getNodeById('cmt')).toBeUndefined()
    expect(store.getNodeById(1)).toBeDefined()

    app.unmount()
  })
})

describe('useMoveNode', () => {
  it('updates position and undo restores the previous one', async () => {
    const { app, result: mutation } = withSetup(() => useMoveNode())
    const store = useFlowStore()
    const history = useHistoryStore()
    store.hydrate(SEED)
    store.setPosition('msg', { x: 0, y: 0 })

    await mutation.mutateAsync({ id: 'msg', position: { x: 80, y: 90 } })
    expect(store.positions['msg']).toEqual({ x: 80, y: 90 })
    expect(history.undoStack.length).toBe(1)

    history.undo()
    expect(store.positions['msg']).toEqual({ x: 0, y: 0 })

    app.unmount()
  })

  it('undo with no previous position deletes the position entry', async () => {
    const { app, result: mutation } = withSetup(() => useMoveNode())
    const store = useFlowStore()
    const history = useHistoryStore()
    store.hydrate(SEED)
    expect(store.positions['msg']).toBeUndefined()

    await mutation.mutateAsync({ id: 'msg', position: { x: 1, y: 2 } })
    expect(store.positions['msg']).toEqual({ x: 1, y: 2 })

    history.undo()
    expect(store.positions['msg']).toBeUndefined()

    app.unmount()
  })

  it('applies secondary moves and restores all of them on undo', async () => {
    const { app, result: mutation } = withSetup(() => useMoveNode())
    const store = useFlowStore()
    const history = useHistoryStore()
    store.hydrate(SEED)
    store.setPosition('dt', { x: 0, y: 0 })
    store.setPosition('s', { x: -100, y: 100 })
    store.setPosition('f', { x: 100, y: 100 })

    await mutation.mutateAsync({
      id: 'dt',
      position: { x: 50, y: 50 },
      previousPosition: { x: 0, y: 0 },
      secondary: [
        { id: 's', from: { x: -100, y: 100 }, to: { x: -50, y: 150 } },
        { id: 'f', from: { x: 100, y: 100 }, to: { x: 150, y: 150 } },
      ],
    })

    expect(store.positions['dt']).toEqual({ x: 50, y: 50 })
    expect(store.positions['s']).toEqual({ x: -50, y: 150 })
    expect(store.positions['f']).toEqual({ x: 150, y: 150 })
    expect(history.undoStack.length).toBe(1)

    history.undo()
    expect(store.positions['dt']).toEqual({ x: 0, y: 0 })
    expect(store.positions['s']).toEqual({ x: -100, y: 100 })
    expect(store.positions['f']).toEqual({ x: 100, y: 100 })

    history.redo()
    expect(store.positions['dt']).toEqual({ x: 50, y: 50 })
    expect(store.positions['s']).toEqual({ x: -50, y: 150 })
    expect(store.positions['f']).toEqual({ x: 150, y: 150 })

    app.unmount()
  })
})

describe('create → undo → redo cycle per editable type', () => {
  it('handles a sendMessage round-trip', async () => {
    const store = useFlowStore()
    const history = useHistoryStore()
    store.hydrate([trigger])
    const { app, result: mutation } = withSetup(() => useCreateNode())

    const node: SendMessageNode = {
      id: 'sm-new',
      parentId: 1,
      type: 'sendMessage',
      name: 'New Message',
      data: { payload: [{ type: 'text', text: 'hello' }] },
    }
    await mutation.mutateAsync({ nodes: [node], position: { x: 10, y: 20 } })
    expect(store.getNodeById('sm-new')).toBeDefined()
    expect(store.positions['sm-new']).toEqual({ x: 10, y: 20 })

    history.undo()
    expect(store.getNodeById('sm-new')).toBeUndefined()

    history.redo()
    expect(getName(store.getNodeById('sm-new'))).toBe('New Message')
    expect(store.positions['sm-new']).toEqual({ x: 10, y: 20 })

    app.unmount()
  })

  it('handles an addComment round-trip', async () => {
    const store = useFlowStore()
    const history = useHistoryStore()
    store.hydrate([trigger])
    const { app, result: mutation } = withSetup(() => useCreateNode())

    const node: AddCommentNode = {
      id: 'ac-new',
      parentId: 1,
      type: 'addComment',
      name: 'Memo',
      data: { comment: 'note me' },
    }
    await mutation.mutateAsync({ nodes: [node], position: { x: 3, y: 4 } })
    expect(getName(store.getNodeById('ac-new'))).toBe('Memo')

    history.undo()
    expect(store.getNodeById('ac-new')).toBeUndefined()

    history.redo()
    expect(getName(store.getNodeById('ac-new'))).toBe('Memo')
    expect(store.positions['ac-new']).toEqual({ x: 3, y: 4 })

    app.unmount()
  })

  it('handles a dateTime trio round-trip in a single history entry', async () => {
    const store = useFlowStore()
    const history = useHistoryStore()
    store.hydrate([trigger])
    const { app, result: mutation } = withSetup(() => useCreateNode())

    const dt: DateTimeNode = {
      id: 'dt-new',
      parentId: 1,
      type: 'dateTime',
      name: 'Hours',
      data: {
        times: [{ day: 'mon', startTime: '09:00', endTime: '17:00' }],
        connectors: ['dt-s', 'dt-f'],
        timezone: 'UTC',
        action: 'businessHours',
      },
    }
    const ok: DateTimeConnectorNode = {
      id: 'dt-s',
      parentId: 'dt-new',
      type: 'dateTimeConnector',
      name: 'Success',
      data: { connectorType: 'success' },
    }
    const no: DateTimeConnectorNode = {
      id: 'dt-f',
      parentId: 'dt-new',
      type: 'dateTimeConnector',
      name: 'Failure',
      data: { connectorType: 'failure' },
    }
    await mutation.mutateAsync({
      nodes: [dt, ok, no],
      positions: {
        'dt-new': { x: 0, y: 0 },
        'dt-s': { x: -100, y: 100 },
        'dt-f': { x: 100, y: 100 },
      },
    })
    expect(store.getNodeById('dt-new')).toBeDefined()
    expect(store.getNodeById('dt-s')).toBeDefined()
    expect(store.getNodeById('dt-f')).toBeDefined()
    expect(history.undoStack.length).toBe(1)

    history.undo()
    expect(store.getNodeById('dt-new')).toBeUndefined()
    expect(store.getNodeById('dt-s')).toBeUndefined()
    expect(store.getNodeById('dt-f')).toBeUndefined()

    history.redo()
    expect(store.getNodeById('dt-new')).toBeDefined()
    expect(store.getNodeById('dt-s')).toBeDefined()
    expect(store.getNodeById('dt-f')).toBeDefined()
    expect(store.positions['dt-new']).toEqual({ x: 0, y: 0 })
    expect(store.positions['dt-s']).toEqual({ x: -100, y: 100 })
    expect(store.positions['dt-f']).toEqual({ x: 100, y: 100 })

    app.unmount()
  })
})

describe('undo / redo persistence', () => {
  it('persists to saveNodes after undo of an update', async () => {
    const { app, result: mutation } = withSetup(() => useUpdateNode())
    const store = useFlowStore()
    const history = useHistoryStore()
    store.hydrate(SEED)

    await mutation.mutateAsync({ id: 'msg', patch: { name: 'Renamed' } as Partial<FlowNode> })
    expect(saveNodesMock).toHaveBeenCalledTimes(1)

    history.undo()
    expect(saveNodesMock).toHaveBeenCalledTimes(2)
    const lastSaveCall = saveNodesMock.mock.calls[saveNodesMock.mock.calls.length - 1]
    const lastSave = (lastSaveCall?.[0] ?? []) as FlowNode[]
    expect(getName(lastSave.find((n) => n.id === 'msg'))).toBe('Welcome')

    history.redo()
    expect(saveNodesMock).toHaveBeenCalledTimes(3)
    const afterRedoCall = saveNodesMock.mock.calls[saveNodesMock.mock.calls.length - 1]
    const afterRedo = (afterRedoCall?.[0] ?? []) as FlowNode[]
    expect(getName(afterRedo.find((n) => n.id === 'msg'))).toBe('Renamed')

    app.unmount()
  })

  it('persists to saveNodes after undo of a delete', async () => {
    const { app, result: mutation } = withSetup(() => useDeleteNode())
    const store = useFlowStore()
    const history = useHistoryStore()
    store.hydrate(SEED)

    await mutation.mutateAsync({ id: 'msg' })
    expect(saveNodesMock).toHaveBeenCalledTimes(1)

    history.undo()
    expect(saveNodesMock).toHaveBeenCalledTimes(2)
    const restoredCall = saveNodesMock.mock.calls[saveNodesMock.mock.calls.length - 1]
    const restored = (restoredCall?.[0] ?? []) as FlowNode[]
    expect(restored.find((n) => n.id === 'msg')).toBeDefined()
    expect(restored.find((n) => n.id === 'cmt')).toBeDefined()

    app.unmount()
  })

  it('persists to saveNodes after undo of a create', async () => {
    const store = useFlowStore()
    const history = useHistoryStore()
    store.hydrate([trigger])
    const { app, result: mutation } = withSetup(() => useCreateNode())

    const node: SendMessageNode = {
      id: 'persist-1',
      parentId: 1,
      type: 'sendMessage',
      name: 'X',
      data: { payload: [] },
    }
    await mutation.mutateAsync({ nodes: [node], position: { x: 0, y: 0 } })
    expect(saveNodesMock).toHaveBeenCalledTimes(1)

    history.undo()
    expect(saveNodesMock).toHaveBeenCalledTimes(2)
    const afterUndoCall = saveNodesMock.mock.calls[saveNodesMock.mock.calls.length - 1]
    const afterUndo = (afterUndoCall?.[0] ?? []) as FlowNode[]
    expect(afterUndo.find((n) => n.id === 'persist-1')).toBeUndefined()

    app.unmount()
  })

  it('persists to saveNodes after undo of a move', async () => {
    const { app, result: mutation } = withSetup(() => useMoveNode())
    const store = useFlowStore()
    const history = useHistoryStore()
    store.hydrate(SEED)
    store.setPosition('msg', { x: 10, y: 10 })

    await mutation.mutateAsync({ id: 'msg', position: { x: 99, y: 99 } })
    expect(saveNodesMock).toHaveBeenCalledTimes(1)

    history.undo()
    expect(saveNodesMock).toHaveBeenCalledTimes(2)
    // saveNodes only stores nodes, not positions — positions are layout state.
    // What we're verifying is that saveNodes was called after undo at all.

    app.unmount()
  })
})

describe('mutation onError', () => {
  it('rolls back the optimistic patch when saveNodes rejects', async () => {
    saveNodesMock.mockRejectedValueOnce(new Error('disk full'))

    const { app, result: mutation } = withSetup(() => useUpdateNode())
    const store = useFlowStore()
    const history = useHistoryStore()
    store.hydrate(SEED)

    await expect(
      mutation.mutateAsync({ id: 'msg', patch: { name: 'Renamed' } as Partial<FlowNode> }),
    ).rejects.toThrow('disk full')
    await nextTick()

    expect(getName(store.getNodeById('msg'))).toBe('Welcome')
    expect(history.undoStack.length).toBe(0)
    expect(history.redoStack.length).toBe(0)

    app.unmount()
  })
})
