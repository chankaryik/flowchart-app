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
