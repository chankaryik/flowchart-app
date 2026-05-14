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
    template:
      '<button type="button" :data-option-value="value" :data-type-option="value"><slot /></button>',
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

async function fillForm(
  wrapper: ReturnType<typeof mountDialog>,
  values: { title: string; description?: string; type: 'sendMessage' | 'addComment' | 'dateTime' },
): Promise<void> {
  await wrapper.find('[data-testid="create-title"]').setValue(values.title)
  if (values.description != null) {
    await wrapper.find('[data-testid="create-description"]').setValue(values.description)
  }
  wrapper.findComponent({ name: 'Select' }).vm.$emit('update:modelValue', values.type)
  await wrapper.vm.$nextTick()
  await flushValidation()
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

describe('CreateNodeDialog — REQUIREMENTS.md form fields', () => {
  it('exposes the three Type of Node options from REQUIREMENTS.md', () => {
    const wrapper = mountDialog()
    const optionValues = wrapper
      .findAll('[data-type-option]')
      .map((el) => el.attributes('data-type-option'))
    expect(optionValues).toEqual(['sendMessage', 'addComment', 'dateTime'])
  })

  it('disables the submit button until title and type are valid', async () => {
    const wrapper = mountDialog()
    const submit = wrapper.find('[data-testid="create-submit"]')
    expect(submit.attributes('disabled')).toBeDefined()

    await wrapper.find('[data-testid="create-title"]').setValue('Hello')
    wrapper.findComponent({ name: 'Select' }).vm.$emit('update:modelValue', 'sendMessage')
    await flushValidation()

    expect(submit.attributes('disabled')).toBeUndefined()
  })

  it('rejects a title longer than 80 characters', async () => {
    const wrapper = mountDialog()
    await wrapper.find('[data-testid="create-title"]').setValue('x'.repeat(81))
    wrapper.findComponent({ name: 'Select' }).vm.$emit('update:modelValue', 'sendMessage')
    await flushValidation()

    expect(wrapper.find('[data-testid="title-error"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="create-submit"]').attributes('disabled')).toBeDefined()
  })

  it('rejects a description longer than 500 characters', async () => {
    const wrapper = mountDialog()
    await wrapper.find('[data-testid="create-title"]').setValue('Greeting')
    await wrapper.find('[data-testid="create-description"]').setValue('y'.repeat(501))
    wrapper.findComponent({ name: 'Select' }).vm.$emit('update:modelValue', 'sendMessage')
    await flushValidation()

    expect(wrapper.find('[data-testid="description-error"]').exists()).toBe(true)
  })
})

describe('CreateNodeDialog — orphan creation (header button)', () => {
  it('creates a sendMessage with parentId=-1 and the entered description', async () => {
    const wrapper = mountDialog()
    await fillForm(wrapper, {
      title: 'Welcome reply',
      description: 'Greets the customer',
      type: 'sendMessage',
    })
    await wrapper.find('form').trigger('submit')
    await flushValidation()

    const call = createNodeMock.mutateAsync.mock.calls[0]?.[0]
    expect(call!.nodes).toHaveLength(1)
    const created = call!.nodes[0]!
    expect(created.type).toBe('sendMessage')
    expect(String(created.parentId)).toBe('-1')
    expect((created as { name: string }).name).toBe('Welcome reply')
    expect((created as { description?: string }).description).toBe('Greets the customer')
  })

  it('creates a dateTime plus its two connectors (still standalone)', async () => {
    const wrapper = mountDialog()
    await fillForm(wrapper, { title: 'Office hours', type: 'dateTime' })
    await wrapper.find('form').trigger('submit')
    await flushValidation()

    const call = createNodeMock.mutateAsync.mock.calls[0]?.[0]
    expect(call!.nodes).toHaveLength(3)
    const [dt, succ, fail] = call!.nodes
    expect(dt!.type).toBe('dateTime')
    expect(String(dt!.parentId)).toBe('-1')
    expect((succ as DateTimeConnectorNode).data.connectorType).toBe('success')
    expect((fail as DateTimeConnectorNode).data.connectorType).toBe('failure')
    expect((dt as DateTimeNode).data.connectors).toEqual([succ!.id, fail!.id])
  })

  it('omits description when only whitespace was entered', async () => {
    const wrapper = mountDialog()
    await fillForm(wrapper, { title: 'Note', description: '   ', type: 'addComment' })
    await wrapper.find('form').trigger('submit')
    await flushValidation()

    const created = createNodeMock.mutateAsync.mock.calls[0]?.[0]?.nodes[0]
    expect((created as { description?: string }).description).toBeUndefined()
  })
})

describe('CreateNodeDialog — child creation (per-node + button)', () => {
  it('uses the preset parent id when one is supplied', async () => {
    const store = useFlowStore()
    store.openCreateDialog('s')
    const wrapper = mountDialog()

    await fillForm(wrapper, { title: 'After success', type: 'sendMessage' })
    await wrapper.find('form').trigger('submit')
    await flushValidation()

    const call = createNodeMock.mutateAsync.mock.calls[0]?.[0]
    expect(String(call!.nodes[0]!.parentId)).toBe('s')
  })
})
