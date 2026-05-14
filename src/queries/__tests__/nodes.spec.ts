import { VueQueryPlugin } from '@tanstack/vue-query'
import { createPinia, getActivePinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createApp, defineComponent, h } from 'vue'

import type {
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

const SEED: FlowNode[] = [trigger, dateTimeNode, success, failure, sendMessage]

type Harness<T> = { result: T; app: ReturnType<typeof createApp> }

function withSetup<T>(composable: () => T): Harness<T> {
  let result!: T
  const Comp = defineComponent({
    setup() {
      // Register the persistence watcher in useNodesQuery before exercising a
      // mutation so saveNodes fires reactively on store changes.
      useNodesQuery()
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
    const { app } = withSetup(() => useNodesQuery())
    const store = useFlowStore()
    expect(store.nodes).toHaveLength(0)
    await vi.waitFor(() => expect(store.nodes).toHaveLength(SEED.length))
    app.unmount()
  })
})

describe('useCreateNode', () => {
  it('appends nodes, records position, pushes history, persists to saveNodes, and undoes cleanly', async () => {
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
    expect(saveNodesMock).toHaveBeenCalled()

    history.undo()
    expect(store.getNodeById('new1')).toBeUndefined()
    const lastCall = saveNodesMock.mock.calls[saveNodesMock.mock.calls.length - 1]!
    expect((lastCall[0] as FlowNode[]).find((n) => n.id === 'new1')).toBeUndefined()

    app.unmount()
  })

  it('creates a dateTime trio (parent + success + failure) in a single history entry', async () => {
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
      id: 'dt-s', parentId: 'dt-new', type: 'dateTimeConnector',
      name: 'Success', data: { connectorType: 'success' },
    }
    const no: DateTimeConnectorNode = {
      id: 'dt-f', parentId: 'dt-new', type: 'dateTimeConnector',
      name: 'Failure', data: { connectorType: 'failure' },
    }
    await mutation.mutateAsync({
      nodes: [dt, ok, no],
      positions: {
        'dt-new': { x: 0, y: 0 },
        'dt-s': { x: -100, y: 100 },
        'dt-f': { x: 100, y: 100 },
      },
    })
    expect(history.undoStack.length).toBe(1)

    history.undo()
    expect(store.getNodeById('dt-new')).toBeUndefined()
    expect(store.getNodeById('dt-s')).toBeUndefined()
    expect(store.getNodeById('dt-f')).toBeUndefined()

    app.unmount()
  })
})

describe('useUpdateNode', () => {
  it('patches the node, undoes, and redoes the previous value', async () => {
    const store = useFlowStore()
    const history = useHistoryStore()
    store.hydrate(SEED)
    const { app, result: mutation } = withSetup(() => useUpdateNode())

    await mutation.mutateAsync({ id: 'msg', patch: { name: 'Renamed' } as Partial<FlowNode> })
    expect(getName(store.getNodeById('msg'))).toBe('Renamed')

    history.undo()
    expect(getName(store.getNodeById('msg'))).toBe('Welcome')

    history.redo()
    expect(getName(store.getNodeById('msg'))).toBe('Renamed')

    // Persistence fired for each store mutation (mutate, undo, redo).
    expect(saveNodesMock).toHaveBeenCalledTimes(3)

    app.unmount()
  })
})

describe('useDeleteNode', () => {
  it('cascades the subtree and undo restores nodes and positions', async () => {
    const store = useFlowStore()
    const history = useHistoryStore()
    store.hydrate(SEED)
    store.setPosition('msg', { x: 100, y: 200 })
    const { app, result: mutation } = withSetup(() => useDeleteNode())

    await mutation.mutateAsync({ id: 'msg' })
    expect(store.getNodeById('msg')).toBeUndefined()
    expect(store.positions['msg']).toBeUndefined()

    history.undo()
    expect(getName(store.getNodeById('msg'))).toBe('Welcome')
    expect(store.positions['msg']).toEqual({ x: 100, y: 200 })

    app.unmount()
  })

  it('cascading delete of a dateTime removes both connectors (and their descendants)', async () => {
    const store = useFlowStore()
    store.hydrate(SEED)
    const { app, result: mutation } = withSetup(() => useDeleteNode())

    await mutation.mutateAsync({ id: 'dt' })
    expect(store.getNodeById('dt')).toBeUndefined()
    expect(store.getNodeById('s')).toBeUndefined()
    expect(store.getNodeById('f')).toBeUndefined()
    expect(store.getNodeById('msg')).toBeUndefined()
    expect(store.getNodeById(1)).toBeDefined()

    app.unmount()
  })
})

describe('useMoveNode', () => {
  it('updates position, supports secondary moves, and round-trips via undo/redo', async () => {
    const store = useFlowStore()
    const history = useHistoryStore()
    store.hydrate(SEED)
    store.setPosition('dt', { x: 0, y: 0 })
    store.setPosition('s', { x: -100, y: 100 })
    store.setPosition('f', { x: 100, y: 100 })
    const { app, result: mutation } = withSetup(() => useMoveNode())

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

    history.undo()
    expect(store.positions['dt']).toEqual({ x: 0, y: 0 })
    expect(store.positions['s']).toEqual({ x: -100, y: 100 })

    // saveNodes never fires for pure position changes — positions live outside
    // the payload (recomputed by computeLayout on load).
    expect(saveNodesMock).not.toHaveBeenCalled()

    app.unmount()
  })

  it('undo with no previous position deletes the position entry', async () => {
    const store = useFlowStore()
    const history = useHistoryStore()
    store.hydrate(SEED)
    const { app, result: mutation } = withSetup(() => useMoveNode())

    await mutation.mutateAsync({ id: 'msg', position: { x: 1, y: 2 } })
    expect(store.positions['msg']).toEqual({ x: 1, y: 2 })

    history.undo()
    expect(store.positions['msg']).toBeUndefined()

    app.unmount()
  })
})
