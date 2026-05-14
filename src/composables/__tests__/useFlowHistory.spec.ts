import { createPinia, getActivePinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createApp, defineComponent, h } from 'vue'

import { useFlowHistory } from '@/composables/useFlowHistory'
import { useHistoryStore } from '@/stores/history'

type MountedHarness = {
  unmount: () => void
}

function mountWithComposable(): MountedHarness {
  const Comp = defineComponent({
    setup() {
      useFlowHistory()
      return () => h('div')
    },
  })
  const app = createApp(Comp)
  const pinia = getActivePinia()
  if (pinia == null) throw new Error('Pinia must be active before mountWithComposable')
  app.use(pinia)
  const container = document.createElement('div')
  document.body.appendChild(container)
  app.mount(container)
  return {
    unmount: () => {
      app.unmount()
      container.remove()
    },
  }
}

function setPlatform(value: string): void {
  Object.defineProperty(window.navigator, 'platform', {
    configurable: true,
    value,
  })
}

function dispatchKey(opts: KeyboardEventInit & { target?: HTMLElement }): KeyboardEvent {
  const event = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...opts })
  const target = opts.target ?? window
  target.dispatchEvent(event)
  return event
}

beforeEach(() => {
  setActivePinia(createPinia())
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('useFlowHistory (non-mac)', () => {
  beforeEach(() => {
    setPlatform('Win32')
  })

  it('Ctrl+Z triggers history.undo', () => {
    setActivePinia(createPinia())
    const history = useHistoryStore()
    const undo = vi.spyOn(history, 'undo')
    const harness = mountWithComposable()

    dispatchKey({ key: 'z', ctrlKey: true })

    expect(undo).toHaveBeenCalledTimes(1)
    harness.unmount()
  })

  it('Ctrl+Shift+Z triggers history.redo', () => {
    setActivePinia(createPinia())
    const history = useHistoryStore()
    const redo = vi.spyOn(history, 'redo')
    const undo = vi.spyOn(history, 'undo')
    const harness = mountWithComposable()

    dispatchKey({ key: 'z', ctrlKey: true, shiftKey: true })

    expect(redo).toHaveBeenCalledTimes(1)
    expect(undo).not.toHaveBeenCalled()
    harness.unmount()
  })

  it('Ctrl+Y triggers history.redo on Windows', () => {
    setActivePinia(createPinia())
    const history = useHistoryStore()
    const redo = vi.spyOn(history, 'redo')
    const harness = mountWithComposable()

    dispatchKey({ key: 'y', ctrlKey: true })

    expect(redo).toHaveBeenCalledTimes(1)
    harness.unmount()
  })

  it('Cmd+Z also triggers undo (unified Ctrl/Cmd handling)', () => {
    setActivePinia(createPinia())
    const history = useHistoryStore()
    const undo = vi.spyOn(history, 'undo')
    const harness = mountWithComposable()

    dispatchKey({ key: 'z', metaKey: true })

    expect(undo).toHaveBeenCalledTimes(1)
    harness.unmount()
  })

  it('ignores Ctrl+Z when focus is in a textarea', () => {
    setActivePinia(createPinia())
    const history = useHistoryStore()
    const undo = vi.spyOn(history, 'undo')
    const harness = mountWithComposable()

    const textarea = document.createElement('textarea')
    document.body.appendChild(textarea)

    dispatchKey({ key: 'z', ctrlKey: true, target: textarea })

    expect(undo).not.toHaveBeenCalled()
    textarea.remove()
    harness.unmount()
  })

  it('ignores Ctrl+Z when focus is in an input', () => {
    setActivePinia(createPinia())
    const history = useHistoryStore()
    const undo = vi.spyOn(history, 'undo')
    const harness = mountWithComposable()

    const input = document.createElement('input')
    document.body.appendChild(input)

    dispatchKey({ key: 'z', ctrlKey: true, target: input })

    expect(undo).not.toHaveBeenCalled()
    input.remove()
    harness.unmount()
  })

  it('ignores Ctrl+Z when focus is in a contenteditable element', () => {
    setActivePinia(createPinia())
    const history = useHistoryStore()
    const undo = vi.spyOn(history, 'undo')
    const harness = mountWithComposable()

    const div = document.createElement('div')
    div.setAttribute('contenteditable', 'true')
    document.body.appendChild(div)

    dispatchKey({ key: 'z', ctrlKey: true, target: div })

    expect(undo).not.toHaveBeenCalled()
    div.remove()
    harness.unmount()
  })

  it('removes the listener on unmount', () => {
    setActivePinia(createPinia())
    const history = useHistoryStore()
    const undo = vi.spyOn(history, 'undo')
    const harness = mountWithComposable()
    harness.unmount()

    dispatchKey({ key: 'z', ctrlKey: true })

    expect(undo).not.toHaveBeenCalled()
  })

  it('does not trigger on Alt+Ctrl+Z', () => {
    setActivePinia(createPinia())
    const history = useHistoryStore()
    const undo = vi.spyOn(history, 'undo')
    const harness = mountWithComposable()

    dispatchKey({ key: 'z', ctrlKey: true, altKey: true })

    expect(undo).not.toHaveBeenCalled()
    harness.unmount()
  })
})

describe('useFlowHistory integration with history store', () => {
  beforeEach(() => {
    setPlatform('Win32')
  })

  it('full undo → redo cycle restores state via keyboard', () => {
    const history = useHistoryStore()
    const harness = mountWithComposable()

    let state = 'initial'
    history.push({
      label: 'Test',
      undo: () => {
        state = 'undone'
      },
      redo: () => {
        state = 'redone'
      },
    })

    dispatchKey({ key: 'z', ctrlKey: true })
    expect(state).toBe('undone')

    dispatchKey({ key: 'z', ctrlKey: true, shiftKey: true })
    expect(state).toBe('redone')

    harness.unmount()
  })
})

describe('useFlowHistory (mac)', () => {
  beforeEach(() => {
    setPlatform('MacIntel')
  })

  it('Cmd+Z triggers history.undo', () => {
    setActivePinia(createPinia())
    const history = useHistoryStore()
    const undo = vi.spyOn(history, 'undo')
    const harness = mountWithComposable()

    dispatchKey({ key: 'z', metaKey: true })

    expect(undo).toHaveBeenCalledTimes(1)
    harness.unmount()
  })

  it('Cmd+Shift+Z triggers history.redo', () => {
    setActivePinia(createPinia())
    const history = useHistoryStore()
    const redo = vi.spyOn(history, 'redo')
    const harness = mountWithComposable()

    dispatchKey({ key: 'z', metaKey: true, shiftKey: true })

    expect(redo).toHaveBeenCalledTimes(1)
    harness.unmount()
  })

  it('Ctrl+Z also triggers undo on mac (unified Ctrl/Cmd handling)', () => {
    setActivePinia(createPinia())
    const history = useHistoryStore()
    const undo = vi.spyOn(history, 'undo')
    const harness = mountWithComposable()

    dispatchKey({ key: 'z', ctrlKey: true })

    expect(undo).toHaveBeenCalledTimes(1)
    harness.unmount()
  })

  it('Cmd+Y does NOT trigger redo on mac (windows-only binding)', () => {
    setActivePinia(createPinia())
    const history = useHistoryStore()
    const redo = vi.spyOn(history, 'redo')
    const harness = mountWithComposable()

    dispatchKey({ key: 'y', metaKey: true })

    expect(redo).not.toHaveBeenCalled()
    harness.unmount()
  })
})
