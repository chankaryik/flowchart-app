import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

import type {
  DateTimeConnectorNode,
  DateTimeNode,
  FlowNode,
  TriggerNode,
} from '@/lib/types'
import type { CreateNodeVars } from '@/queries/nodes'
import { useFlowStore } from '@/stores/flow'

async function flushValidation(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 20))
  await flushPromises()
}

type MutateAsyncMock = ReturnType<typeof vi.fn<(vars: CreateNodeVars) => Promise<void>>>

let createNodeMock: { mutateAsync: MutateAsyncMock; isPending: ReturnType<typeof ref<boolean>> }
const pushMock = vi.fn<(to: string) => void>()

vi.mock('@/queries/nodes', () => ({
  useCreateNode: () => createNodeMock,
}))

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: pushMock }),
}))

const dialogStubs = {
  Dialog: { props: ['open'], template: '<div :data-open="open"><slot /></div>' },
  DialogContent: { template: '<div><slot /></div>' },
  DialogHeader: { template: '<div><slot /></div>' },
  DialogTitle: { template: '<h2><slot /></h2>' },
  DialogDescription: { template: '<p><slot /></p>' },
  DialogFooter: { template: '<footer><slot /></footer>' },
}

const selectStubs = {
  Select: {
    name: 'Select',
    props: ['modelValue'],
    emits: ['update:modelValue'],
    template: '<div :data-value="modelValue ?? \'\'"><slot /></div>',
  },
  SelectTrigger: { template: '<span><slot /></span>' },
  SelectValue: { template: '<span><slot /></span>' },
  SelectContent: { template: '<div><slot /></div>' },
  SelectItem: {
    props: ['value'],
    template: '<button type="button" :data-option-value="value"><slot /></button>',
  },
}

const trigger: TriggerNode = {
  id: 1,
  parentId: -1,
  type: 'trigger',
  data: { type: 'conversationOpened', oncePerContact: false },
}

const successConnector: DateTimeConnectorNode = {
  id: 's',
  parentId: 'dt',
  type: 'dateTimeConnector',
  name: 'Success',
  data: { connectorType: 'success' },
}

const failureConnector: DateTimeConnectorNode = {
  id: 'f',
  parentId: 'dt',
  type: 'dateTimeConnector',
  name: 'Failure',
  data: { connectorType: 'failure' },
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

const SEED: FlowNode[] = [trigger, dateTimeNode, successConnector, failureConnector]

const { default: CreateNodeDialog } = await import('../CreateNodeDialog.vue')

function mountDialog() {
  return mount(CreateNodeDialog, {
    props: { open: true },
    global: { stubs: { ...dialogStubs, ...selectStubs } },
  })
}

beforeEach(() => {
  setActivePinia(createPinia())
  const store = useFlowStore()
  store.hydrate(SEED)
  store.setPosition(1, { x: 0, y: 0 })

  createNodeMock = {
    mutateAsync: vi.fn<(vars: CreateNodeVars) => Promise<void>>().mockResolvedValue(undefined),
    isPending: ref(false),
  }
  pushMock.mockReset()
})

describe('CreateNodeDialog — domain rules', () => {
  it('lists only editable types (no trigger, no connector) — CLAUDE.md §8.1', () => {
    const wrapper = mountDialog()
    const optionValues = wrapper
      .findAll('[data-type-option]')
      .map((el) => el.attributes('data-type-option'))
    expect(optionValues).toEqual(['sendMessage', 'dateTime', 'addComment'])
  })

  it('auto-creates success and failure connectors when the new node is a dateTime', async () => {
    const wrapper = mountDialog()
    await wrapper.find('[data-type-option="dateTime"]').trigger('click')
    await wrapper.find('[data-testid="create-next"]').trigger('click')

    const select = wrapper.findComponent({ name: 'Select' })
    select.vm.$emit('update:modelValue', '1')
    await wrapper.vm.$nextTick()
    await wrapper.find('[data-testid="create-next"]').trigger('click')
    await flushValidation()
    await wrapper.find('form').trigger('submit')
    await flushValidation()

    const call = createNodeMock.mutateAsync.mock.calls[0]?.[0]
    expect(call!.nodes).toHaveLength(3)
    const [dt, succ, fail] = call!.nodes
    expect(dt!.type).toBe('dateTime')
    expect((succ as DateTimeConnectorNode).data.connectorType).toBe('success')
    expect((fail as DateTimeConnectorNode).data.connectorType).toBe('failure')
    expect((dt as DateTimeNode).data.connectors).toEqual([succ!.id, fail!.id])
  })

  it('allows a connector as parent (CLAUDE.md: any node can be a parent)', async () => {
    const store = useFlowStore()
    store.openCreateDialog('s')
    const wrapper = mountDialog()

    await wrapper.find('[data-type-option="sendMessage"]').trigger('click')
    await wrapper.find('[data-testid="create-next"]').trigger('click')
    await wrapper.find('#create-name').setValue('After success')
    await flushValidation()
    await wrapper.find('form').trigger('submit')
    await flushValidation()

    const call = createNodeMock.mutateAsync.mock.calls[0]?.[0]
    expect(String(call!.nodes[0]!.parentId)).toBe('s')
  })
})
