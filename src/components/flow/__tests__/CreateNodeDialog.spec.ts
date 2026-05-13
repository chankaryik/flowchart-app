import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

import type {
  DateTimeConnectorNode,
  DateTimeNode,
  FlowNode,
  SendMessageNode,
  TriggerNode,
} from '@/lib/types'
import type { CreateNodeVars } from '@/queries/nodes'
import { useFlowStore } from '@/stores/flow'

type MutateAsyncMock = ReturnType<typeof vi.fn<(vars: CreateNodeVars) => Promise<void>>>

let createNodeMock: { mutateAsync: MutateAsyncMock; isPending: ReturnType<typeof ref<boolean>> }
const pushMock = vi.fn<(to: string) => void>()

vi.mock('@/queries/nodes', () => ({
  useCreateNode: () => createNodeMock,
}))

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: pushMock }),
}))

// Reka-ui DialogPortal renders into a portal that jsdom doesn't materialize.
// Stub the Dialog primitives so their slots render inline and we can assert
// on the contents. Stub Select to expose its options as native DOM siblings
// (using a div wrapper to keep them in the regular DOM tree, not template.content).
const dialogStubs = {
  Dialog: {
    name: 'Dialog',
    props: ['open'],
    template: '<div data-testid="dialog-root" :data-open="open"><slot /></div>',
  },
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
    template:
      '<div data-stub="select" :data-value="modelValue ?? \'\'"><slot /></div>',
  },
  SelectTrigger: { template: '<span><slot /></span>' },
  SelectValue: { template: '<span><slot /></span>' },
  SelectContent: { template: '<div data-stub="select-content"><slot /></div>' },
  SelectItem: {
    name: 'SelectItem',
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

const message: SendMessageNode = {
  id: 'msg',
  parentId: 1,
  type: 'sendMessage',
  name: 'Hi',
  data: { payload: [{ type: 'text', text: 'hi' }] },
}

const SEED: FlowNode[] = [trigger, dateTimeNode, successConnector, failureConnector, message]

const { default: CreateNodeDialog } = await import('../CreateNodeDialog.vue')

function mountDialog() {
  return mount(CreateNodeDialog, {
    props: { open: true },
    global: {
      stubs: { ...dialogStubs, ...selectStubs },
    },
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

describe('CreateNodeDialog', () => {
  it('only lists editable node types (no trigger or connector)', () => {
    const wrapper = mountDialog()
    const optionValues = wrapper
      .findAll('[data-type-option]')
      .map((el) => el.attributes('data-type-option'))
    expect(optionValues).toEqual(['sendMessage', 'dateTime', 'addComment'])
    expect(optionValues).not.toContain('trigger')
    expect(optionValues).not.toContain('dateTimeConnector')
  })

  it('disables Next until a type is selected', async () => {
    const wrapper = mountDialog()
    const next = wrapper.find('[data-testid="create-next"]')
    expect(next.attributes('disabled')).toBeDefined()
    await wrapper.find('[data-type-option="sendMessage"]').trigger('click')
    expect(next.attributes('disabled')).toBeUndefined()
  })

  it('lets the user pick a connector as a parent', async () => {
    const wrapper = mountDialog()
    await wrapper.find('[data-type-option="sendMessage"]').trigger('click')
    await wrapper.find('[data-testid="create-next"]').trigger('click')

    const optionValues = wrapper
      .findAll('[data-option-value]')
      .map((el) => el.attributes('data-option-value'))
    expect(optionValues).toContain('s')
    expect(optionValues).toContain('f')
  })

  it('creates a single sendMessage node under the chosen parent', async () => {
    const wrapper = mountDialog()
    await wrapper.find('[data-type-option="sendMessage"]').trigger('click')
    await wrapper.find('[data-testid="create-next"]').trigger('click')

    const select = wrapper.findComponent({ name: 'Select' })
    select.vm.$emit('update:modelValue', '1')
    await wrapper.vm.$nextTick()
    await wrapper.find('[data-testid="create-next"]').trigger('click')

    await wrapper.find('#create-name').setValue('Welcome msg')
    await wrapper.find('form').trigger('submit.prevent')

    expect(createNodeMock.mutateAsync).toHaveBeenCalledTimes(1)
    const call = createNodeMock.mutateAsync.mock.calls[0]?.[0]
    expect(call).toBeDefined()
    expect(call!.nodes).toHaveLength(1)
    const created = call!.nodes[0]!
    expect(created.type).toBe('sendMessage')
    expect(String(created.parentId)).toBe('1')
    expect((created as SendMessageNode).name).toBe('Welcome msg')
    expect(pushMock).toHaveBeenCalledWith(`/node/${created.id}`)
  })

  it('auto-creates success and failure connectors when creating a dateTime', async () => {
    const wrapper = mountDialog()
    await wrapper.find('[data-type-option="dateTime"]').trigger('click')
    await wrapper.find('[data-testid="create-next"]').trigger('click')

    const select = wrapper.findComponent({ name: 'Select' })
    select.vm.$emit('update:modelValue', '1')
    await wrapper.vm.$nextTick()
    await wrapper.find('[data-testid="create-next"]').trigger('click')
    await wrapper.find('form').trigger('submit.prevent')

    const call = createNodeMock.mutateAsync.mock.calls[0]?.[0]
    expect(call).toBeDefined()
    expect(call!.nodes).toHaveLength(3)
    const [dt, succ, fail] = call!.nodes
    expect(dt!.type).toBe('dateTime')
    expect(succ!.type).toBe('dateTimeConnector')
    expect((succ as DateTimeConnectorNode).data.connectorType).toBe('success')
    expect(fail!.type).toBe('dateTimeConnector')
    expect((fail as DateTimeConnectorNode).data.connectorType).toBe('failure')
    expect((dt as DateTimeNode).data.connectors).toEqual([succ!.id, fail!.id])

    expect(call!.positions).toBeDefined()
    expect(Object.keys(call!.positions!)).toHaveLength(3)

    expect(pushMock).toHaveBeenCalledWith(`/node/${dt!.id}`)
  })

  it('blocks submit when the name is empty', async () => {
    const wrapper = mountDialog()
    await wrapper.find('[data-type-option="addComment"]').trigger('click')
    await wrapper.find('[data-testid="create-next"]').trigger('click')

    const select = wrapper.findComponent({ name: 'Select' })
    select.vm.$emit('update:modelValue', '1')
    await wrapper.vm.$nextTick()
    await wrapper.find('[data-testid="create-next"]').trigger('click')

    await wrapper.find('#create-name').setValue('')
    await wrapper.find('form').trigger('submit.prevent')

    expect(createNodeMock.mutateAsync).not.toHaveBeenCalled()
    expect(wrapper.find('[data-testid="name-error"]').exists()).toBe(true)
  })

  it('emits update:open(false) on Cancel', async () => {
    const wrapper = mountDialog()
    const cancel = wrapper
      .findAll('button[type="button"]')
      .find((b) => b.text().trim() === 'Cancel')
    if (cancel == null) throw new Error('Cancel button not found')
    await cancel.trigger('click')
    const events = wrapper.emitted('update:open')
    expect(events).toBeTruthy()
    expect(events![events!.length - 1]).toEqual([false])
  })

  describe('with a preset parent (plus-button-on-node flow)', () => {
    it('skips the parent step and goes type -> details', async () => {
      const store = useFlowStore()
      store.openCreateDialog('msg')
      const wrapper = mountDialog()

      await wrapper.find('[data-type-option="sendMessage"]').trigger('click')
      await wrapper.find('[data-testid="create-next"]').trigger('click')

      // No parent step was rendered; we landed on details.
      expect(wrapper.find('[data-testid="step-parent"]').exists()).toBe(false)
      expect(wrapper.find('[data-testid="step-details"]').exists()).toBe(true)
    })

    it('locks the parent to the preset id on submit', async () => {
      const store = useFlowStore()
      store.openCreateDialog('msg')
      const wrapper = mountDialog()

      await wrapper.find('[data-type-option="addComment"]').trigger('click')
      await wrapper.find('[data-testid="create-next"]').trigger('click')
      await wrapper.find('#create-name').setValue('Follow-up note')
      await wrapper.find('form').trigger('submit.prevent')

      const call = createNodeMock.mutateAsync.mock.calls[0]?.[0]
      expect(call).toBeDefined()
      expect(call!.nodes).toHaveLength(1)
      expect(String(call!.nodes[0]!.parentId)).toBe('msg')
    })

    it('lets the user attach a new node under a connector via its plus button', async () => {
      const store = useFlowStore()
      store.openCreateDialog('s')
      const wrapper = mountDialog()

      await wrapper.find('[data-type-option="sendMessage"]').trigger('click')
      await wrapper.find('[data-testid="create-next"]').trigger('click')
      await wrapper.find('#create-name').setValue('After success')
      await wrapper.find('form').trigger('submit.prevent')

      const call = createNodeMock.mutateAsync.mock.calls[0]?.[0]
      expect(call).toBeDefined()
      expect(String(call!.nodes[0]!.parentId)).toBe('s')
    })

    it('Back from details returns to the type step (parent step is hidden)', async () => {
      const store = useFlowStore()
      store.openCreateDialog('msg')
      const wrapper = mountDialog()

      await wrapper.find('[data-type-option="sendMessage"]').trigger('click')
      await wrapper.find('[data-testid="create-next"]').trigger('click')

      const back = wrapper
        .findAll('button[type="button"]')
        .find((b) => b.text().trim() === 'Back')
      if (back == null) throw new Error('Back button not found')
      await back.trigger('click')

      expect(wrapper.find('[data-testid="step-type"]').exists()).toBe(true)
      expect(wrapper.find('[data-testid="step-parent"]').exists()).toBe(false)
    })
  })
})
