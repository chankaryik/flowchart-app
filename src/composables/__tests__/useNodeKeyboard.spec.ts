import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createApp, defineComponent, h } from 'vue'

import { useNodeKeyboard } from '@/composables/useNodeKeyboard'
import type { FlowNode } from '@/lib/types'
import { useFlowStore, type Position } from '@/stores/flow'

const { pushMock, routeRef, stableRoute } = vi.hoisted(() => {
  const innerRef: { value: { params: { id?: string } } } = { value: { params: {} } }
  return {
    pushMock: vi.fn<(to: string) => void>(),
    routeRef: innerRef,
    stableRoute: {
      get params() {
        return innerRef.value.params
      },
    },
  }
})

vi.mock('vue-router', () => ({
  useRoute: () => stableRoute,
  useRouter: () => ({ push: pushMock }),
}))

function seedFlow(): FlowNode[] {
  return [
    { id: 1, parentId: -1, type: 'trigger', data: { type: 'x', oncePerContact: false } },
    {
      id: 'dt',
      parentId: 1,
      type: 'dateTime',
      name: 'dt',
      data: { times: [], connectors: ['ok', 'no'], timezone: 'UTC', action: 'businessHours' },
    },
    { id: 'ok', parentId: 'dt', type: 'dateTimeConnector', name: 'ok', data: { connectorType: 'success' } },
    { id: 'no', parentId: 'dt', type: 'dateTimeConnector', name: 'no', data: { connectorType: 'failure' } },
    { id: 'm1', parentId: 'ok', type: 'sendMessage', name: 'm1', data: { payload: [] } },
    { id: 'c1', parentId: 'no', type: 'addComment', name: 'c1', data: { comment: '' } },
  ]
}

function seedPositions(): Record<string, Position> {
  return {
    '1': { x: 200, y: 0 },
    dt: { x: 200, y: 160 },
    ok: { x: 100, y: 320 },
    no: { x: 300, y: 320 },
    m1: { x: 100, y: 480 },
    c1: { x: 300, y: 480 },
  }
}

type Harness = { unmount: () => void; helpCalls: { count: number } }

function mountKeyboardComposable(): Harness {
  const helpCalls = { count: 0 }
  const Comp = defineComponent({
    setup() {
      useNodeKeyboard({ onHelp: () => (helpCalls.count += 1) })
      return () => h('div')
    },
  })
  const app = createApp(Comp)
  const pinia = createPinia()
  setActivePinia(pinia)
  app.use(pinia)
  const container = document.createElement('div')
  document.body.appendChild(container)
  app.mount(container)
  return {
    unmount: () => {
      app.unmount()
      container.remove()
    },
    helpCalls,
  }
}

function placeNodeElement(id: string): HTMLElement {
  const el = document.createElement('div')
  el.setAttribute('data-flow-node-id', id)
  el.setAttribute('tabindex', '0')
  document.body.appendChild(el)
  return el
}

function dispatchKey(opts: KeyboardEventInit & { target?: HTMLElement | Window }): KeyboardEvent {
  const event = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...opts })
  ;(opts.target ?? window).dispatchEvent(event)
  return event
}

describe('useNodeKeyboard (integration)', () => {
  let harness: Harness
  let elements: Record<string, HTMLElement>

  beforeEach(() => {
    setActivePinia(createPinia())
    pushMock.mockReset()
    routeRef.value = { params: {} }
    harness = mountKeyboardComposable()

    const store = useFlowStore()
    store.hydrate(seedFlow())
    store.setPositions(seedPositions())

    elements = {}
    for (const id of ['1', 'dt', 'm1', 'c1']) {
      elements[id] = placeNodeElement(id)
    }
  })

  afterEach(() => {
    for (const el of Object.values(elements)) el.remove()
    harness.unmount()
    vi.restoreAllMocks()
  })

  it('Tab moves focus through editable nodes and wraps at the end', () => {
    elements['c1']!.focus()
    dispatchKey({ key: 'Tab', target: elements['c1']! })
    expect(document.activeElement).toBe(elements['1'])
  })

  it('Shift+Tab cycles in reverse order', () => {
    elements['1']!.focus()
    dispatchKey({ key: 'Tab', shiftKey: true, target: elements['1']! })
    expect(document.activeElement).toBe(elements['c1'])
  })

  it('Tab from outside the canvas falls through to native handling', () => {
    const outside = document.createElement('button')
    document.body.appendChild(outside)
    outside.focus()
    const event = dispatchKey({ key: 'Tab', target: outside })
    expect(event.defaultPrevented).toBe(false)
    outside.remove()
  })

  it('Arrow Down/Right step to the next node in array order', () => {
    elements['1']!.focus()
    dispatchKey({ key: 'ArrowDown', target: elements['1']! })
    expect(document.activeElement).toBe(elements['dt'])
  })

  it('Arrow Up/Left step to the previous node in array order', () => {
    elements['dt']!.focus()
    dispatchKey({ key: 'ArrowUp', target: elements['dt']! })
    expect(document.activeElement).toBe(elements['1'])
  })

  it('skips dateTimeConnector nodes during traversal', () => {
    // The seed includes 'ok' and 'no' connectors between 'dt' and 'm1';
    // arrow navigation should hop straight from 'dt' to 'm1'.
    elements['dt']!.focus()
    dispatchKey({ key: 'ArrowDown', target: elements['dt']! })
    expect(document.activeElement).toBe(elements['m1'])
  })

  it('Enter pushes /node/<id> for the focused node', () => {
    elements['dt']!.focus()
    dispatchKey({ key: 'Enter', target: elements['dt']! })
    expect(pushMock).toHaveBeenCalledWith('/node/dt')
  })

  it('Escape closes an open drawer; no-op when none is open', () => {
    routeRef.value = { params: { id: 'dt' } }
    dispatchKey({ key: 'Escape' })
    expect(pushMock).toHaveBeenCalledWith('/')

    pushMock.mockReset()
    routeRef.value = { params: {} }
    dispatchKey({ key: 'Escape' })
    expect(pushMock).not.toHaveBeenCalled()
  })

  it('? opens the shortcut help dialog', () => {
    dispatchKey({ key: '?' })
    expect(harness.helpCalls.count).toBe(1)
  })

  it('does not respond to shortcuts while focus is in an input', () => {
    const input = document.createElement('input')
    document.body.appendChild(input)
    input.focus()
    dispatchKey({ key: 'ArrowDown', target: input })
    dispatchKey({ key: 'Enter', target: input })
    dispatchKey({ key: '?', target: input })
    expect(pushMock).not.toHaveBeenCalled()
    expect(harness.helpCalls.count).toBe(0)
    input.remove()
  })
})
