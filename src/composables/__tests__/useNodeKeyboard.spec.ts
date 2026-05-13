import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createApp, defineComponent, h } from 'vue'

import {
  computeTabOrder,
  findAdjacent,
  navigableNodeIds,
  useNodeKeyboard,
} from '@/composables/useNodeKeyboard'
import type { FlowNode } from '@/lib/types'
import { useFlowStore, type Position } from '@/stores/flow'

// vi.mock() is hoisted above the imports — anything it references must be
// inside vi.hoisted() so it exists when the factory runs.
const { pushMock, routeRef, stableRoute } = vi.hoisted(() => {
  const innerRef: { value: { params: { id?: string } } } = { value: { params: {} } }
  return {
    pushMock: vi.fn<(to: string) => void>(),
    routeRef: innerRef,
    // Stable proxy: composable captures this once at setup, but reads
    // `params` fresh on every keystroke via the getter.
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
  // A graph with the canonical mid-tree shape from payload.json:
  //
  //              trigger(1)            y=0
  //                 |
  //              dt              y=160
  //              / \
  //            ok   no          y=320  (connectors — skipped by nav)
  //            /     \
  //           m1     c1         y=480
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

describe('navigableNodeIds', () => {
  it('excludes dateTimeConnector nodes', () => {
    const ids = navigableNodeIds(seedFlow())
    expect(ids).toEqual([1, 'dt', 'm1', 'c1'])
  })

  it('returns an empty array for an empty graph', () => {
    expect(navigableNodeIds([])).toEqual([])
  })
})

describe('computeTabOrder', () => {
  it('sorts top-down then left-right', () => {
    const positions = seedPositions()
    const order = computeTabOrder([1, 'dt', 'm1', 'c1'], positions)
    expect(order).toEqual([1, 'dt', 'm1', 'c1'])
  })

  it('groups nodes within the row tolerance and orders by x', () => {
    const positions: Record<string, Position> = {
      a: { x: 300, y: 100 },
      b: { x: 100, y: 105 }, // same row as a (within tolerance)
      c: { x: 200, y: 90 }, // same row as a too
      d: { x: 50, y: 500 }, // next row
    }
    const order = computeTabOrder(['a', 'b', 'c', 'd'], positions)
    expect(order).toEqual(['b', 'c', 'a', 'd'])
  })

  it('appends nodes lacking a position so the cycle never drops them', () => {
    const positions: Record<string, Position> = {
      a: { x: 0, y: 0 },
    }
    const order = computeTabOrder(['a', 'lost'], positions)
    expect(order).toEqual(['a', 'lost'])
  })
})

describe('findAdjacent', () => {
  it('returns null when the from node has no position', () => {
    expect(findAdjacent('missing', ['1'], seedPositions(), 'up')).toBeNull()
  })

  it('moves down from trigger to dateTime', () => {
    expect(findAdjacent(1, [1, 'dt', 'm1', 'c1'], seedPositions(), 'down')).toBe('dt')
  })

  it('moves up from dateTime back to trigger', () => {
    expect(findAdjacent('dt', [1, 'dt', 'm1', 'c1'], seedPositions(), 'up')).toBe(1)
  })

  it('skips connectors and lands on the next non-connector going down', () => {
    // Candidates intentionally exclude 'ok'/'no' (connectors are skipped).
    const next = findAdjacent('dt', [1, 'dt', 'm1', 'c1'], seedPositions(), 'down')
    expect(next === 'm1' || next === 'c1').toBe(true)
  })

  it('moves right to the nearest node on the same row', () => {
    const next = findAdjacent('m1', [1, 'dt', 'm1', 'c1'], seedPositions(), 'right')
    expect(next).toBe('c1')
  })

  it('moves left to the nearest node on the same row', () => {
    const next = findAdjacent('c1', [1, 'dt', 'm1', 'c1'], seedPositions(), 'left')
    expect(next).toBe('m1')
  })

  it('returns null when nothing exists in the requested direction', () => {
    expect(findAdjacent(1, [1, 'dt', 'm1', 'c1'], seedPositions(), 'up')).toBeNull()
  })
})

type Harness = { unmount: () => void; helpCalls: { count: number } }

function mountKeyboardComposable(): Harness {
  const helpCalls = { count: 0 }
  const Comp = defineComponent({
    setup() {
      useNodeKeyboard({
        onHelp: () => {
          helpCalls.count += 1
        },
      })
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
  const target = opts.target ?? window
  target.dispatchEvent(event)
  return event
}

describe('useNodeKeyboard (keyboard integration)', () => {
  let harness: Harness
  let elements: Record<string, HTMLElement>

  beforeEach(() => {
    setActivePinia(createPinia())
    pushMock.mockReset()
    routeRef.value = { params: {} }
    harness = mountKeyboardComposable()

    // The composable was mounted with a fresh pinia; useFlowStore() inside it
    // grabbed that store. Reuse the same active pinia to seed it.
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

  it('Tab moves focus from one node to the next in graph order', () => {
    elements['1']!.focus()
    const event = dispatchKey({ key: 'Tab', target: elements['1']! })
    expect(event.defaultPrevented).toBe(true)
    expect(document.activeElement).toBe(elements['dt'])
  })

  it('Shift+Tab moves focus to the previous node', () => {
    elements['dt']!.focus()
    dispatchKey({ key: 'Tab', shiftKey: true, target: elements['dt']! })
    expect(document.activeElement).toBe(elements['1'])
  })

  it('Tab wraps from the last node back to the first', () => {
    elements['c1']!.focus()
    dispatchKey({ key: 'Tab', target: elements['c1']! })
    expect(document.activeElement).toBe(elements['1'])
  })

  it('Tab from outside the canvas (no flow node focused) falls through', () => {
    const outside = document.createElement('button')
    document.body.appendChild(outside)
    outside.focus()
    const event = dispatchKey({ key: 'Tab', target: outside })
    expect(event.defaultPrevented).toBe(false)
    outside.remove()
  })

  it('ArrowDown moves focus to the closest node below', () => {
    elements['1']!.focus()
    dispatchKey({ key: 'ArrowDown', target: elements['1']! })
    expect(document.activeElement).toBe(elements['dt'])
  })

  it('ArrowRight moves focus to the nearest node on the right', () => {
    elements['m1']!.focus()
    dispatchKey({ key: 'ArrowRight', target: elements['m1']! })
    expect(document.activeElement).toBe(elements['c1'])
  })

  it('Enter pushes the drawer route for the focused node', () => {
    elements['dt']!.focus()
    const event = dispatchKey({ key: 'Enter', target: elements['dt']! })
    expect(event.defaultPrevented).toBe(true)
    expect(pushMock).toHaveBeenCalledWith('/node/dt')
  })

  it('Escape closes an open drawer by pushing /', () => {
    routeRef.value = { params: { id: 'dt' } }
    dispatchKey({ key: 'Escape' })
    expect(pushMock).toHaveBeenCalledWith('/')
  })

  it('Escape on the canvas (no drawer) is a no-op', () => {
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

  it('does not respond to shortcuts modified with Ctrl / Meta', () => {
    elements['dt']!.focus()
    dispatchKey({ key: 'Enter', ctrlKey: true, target: elements['dt']! })
    dispatchKey({ key: 'ArrowDown', metaKey: true, target: elements['dt']! })
    expect(pushMock).not.toHaveBeenCalled()
  })
})
