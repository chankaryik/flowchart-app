import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

import type {
  AddCommentNode,
  DateTimeConnectorNode,
  DateTimeNode,
  FlowNode,
  TriggerNode,
} from '@/lib/types'
import type { DeleteNodeVars } from '@/queries/nodes'
import { useFlowStore } from '@/stores/flow'

type MutateAsyncMock = ReturnType<typeof vi.fn<(vars: DeleteNodeVars) => Promise<void>>>

let deleteMock: { mutateAsync: MutateAsyncMock; isPending: ReturnType<typeof ref<boolean>> }
const pushMock = vi.fn<(to: string) => void>()
const routeRef = ref<{ params: { id?: string } }>({ params: {} })

vi.mock('@/queries/nodes', () => ({
  useDeleteNode: () => deleteMock,
}))

vi.mock('vue-router', () => ({
  useRoute: () => routeRef.value,
  useRouter: () => ({ push: pushMock }),
}))

// Sheet and AlertDialog use reka-ui portals that jsdom can't render directly.
// Stub them so their slots render inline and the open prop is observable.
const overlayStubs = {
  Sheet: {
    name: 'Sheet',
    props: ['open'],
    template: '<div data-testid="sheet" :data-open="open"><slot /></div>',
  },
  SheetContent: { template: '<div><slot /></div>' },
  SheetHeader: { template: '<header><slot /></header>' },
  SheetTitle: { template: '<h2><slot /></h2>' },
  SheetDescription: { template: '<p><slot /></p>' },
  AlertDialog: {
    name: 'AlertDialog',
    props: ['open'],
    template: '<div data-testid="alert" :data-open="open"><slot /></div>',
  },
  AlertDialogContent: { template: '<div><slot /></div>' },
  AlertDialogHeader: { template: '<div><slot /></div>' },
  AlertDialogTitle: { template: '<h3><slot /></h3>' },
  AlertDialogDescription: { template: '<p><slot /></p>' },
  AlertDialogFooter: { template: '<footer><slot /></footer>' },
  AlertDialogCancel: {
    template: '<button data-testid="delete-cancel" type="button"><slot /></button>',
  },
  AlertDialogAction: {
    template:
      '<button data-testid="delete-confirm-action" type="button" @click="$emit(\'click\', $event)"><slot /></button>',
  },
  // The editor components aren't under test here; stub them to avoid mounting.
  // Stubs expose the delete affordance so the drawer's confirm/delete flow can
  // be exercised without dragging in the full editor implementation.
  SendMessageEditor: {
    name: 'SendMessageEditor',
    props: ['node', 'canDelete', 'deletePending'],
    emits: ['delete', 'saved'],
    template:
      '<form data-testid="send-editor"><button v-if="canDelete" data-testid="drawer-delete" type="button" @click="$emit(\'delete\')" /></form>',
  },
  BusinessHoursEditor: {
    name: 'BusinessHoursEditor',
    props: ['node', 'canDelete', 'deletePending'],
    emits: ['delete', 'saved'],
    template:
      '<form data-testid="dt-editor"><button v-if="canDelete" data-testid="drawer-delete" type="button" @click="$emit(\'delete\')" /></form>',
  },
  AddCommentEditor: {
    name: 'AddCommentEditor',
    props: ['node', 'canDelete', 'deletePending'],
    emits: ['delete', 'saved'],
    template:
      '<form data-testid="comment-editor"><button v-if="canDelete" data-testid="drawer-delete" type="button" @click="$emit(\'delete\')" /></form>',
  },
  TriggerDetails: { template: '<div data-testid="trigger-details" />' },
}

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

const comment: AddCommentNode = {
  id: 'cmt',
  parentId: 1,
  type: 'addComment',
  name: 'Note',
  data: { comment: 'hi' },
}

const SEED: FlowNode[] = [trigger, dateTimeNode, success, failure, comment]

const { default: NodeDetailsDrawer } = await import('../NodeDetailsDrawer.vue')

function mountDrawer() {
  return mount(NodeDetailsDrawer, {
    global: { stubs: overlayStubs },
  })
}

beforeEach(() => {
  setActivePinia(createPinia())
  useFlowStore().hydrate(SEED)
  deleteMock = {
    mutateAsync: vi.fn<(vars: DeleteNodeVars) => Promise<void>>().mockResolvedValue(undefined),
    isPending: ref(false),
  }
  pushMock.mockReset()
  routeRef.value = { params: {} }
})

describe('NodeDetailsDrawer delete', () => {
  it('hides the delete button for the trigger node', async () => {
    routeRef.value = { params: { id: '1' } }
    const wrapper = mountDrawer()
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[data-testid="drawer-delete"]').exists()).toBe(false)
  })

  it('shows the delete button for editable nodes', async () => {
    routeRef.value = { params: { id: 'cmt' } }
    const wrapper = mountDrawer()
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[data-testid="drawer-delete"]').exists()).toBe(true)
  })

  it('confirms then deletes and navigates back to /', async () => {
    routeRef.value = { params: { id: 'cmt' } }
    const wrapper = mountDrawer()
    await wrapper.vm.$nextTick()

    await wrapper.find('[data-testid="drawer-delete"]').trigger('click')
    expect(wrapper.find('[data-testid="alert"]').attributes('data-open')).toBe('true')

    await wrapper.find('[data-testid="delete-confirm-action"]').trigger('click')
    await wrapper.vm.$nextTick()
    await wrapper.vm.$nextTick()

    expect(deleteMock.mutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'cmt' }),
    )
    expect(pushMock).toHaveBeenCalledWith('/')
  })
})
