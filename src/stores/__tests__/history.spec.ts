import { setActivePinia, createPinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useHistoryStore } from '@/stores/history'

beforeEach(() => {
  setActivePinia(createPinia())
})

function makeCmd(label: string) {
  return {
    label,
    undo: vi.fn<() => void>(),
    redo: vi.fn<() => void>(),
  }
}

describe('useHistoryStore', () => {
  it('starts empty and has no undo/redo available', () => {
    const store = useHistoryStore()
    expect(store.canUndo).toBe(false)
    expect(store.canRedo).toBe(false)
  })

  it('push adds to the undo stack and clears redo stack', () => {
    const store = useHistoryStore()
    const a = makeCmd('a')
    const b = makeCmd('b')
    store.push(a)
    expect(store.canUndo).toBe(true)
    store.undo()
    expect(store.canRedo).toBe(true)
    store.push(b)
    expect(store.canRedo).toBe(false)
  })

  it('undo pops from undo stack and runs its undo callback', () => {
    const store = useHistoryStore()
    const cmd = makeCmd('a')
    store.push(cmd)
    store.undo()
    expect(cmd.undo).toHaveBeenCalledTimes(1)
    expect(store.canUndo).toBe(false)
    expect(store.canRedo).toBe(true)
  })

  it('redo pops from redo stack and runs its redo callback', () => {
    const store = useHistoryStore()
    const cmd = makeCmd('a')
    store.push(cmd)
    store.undo()
    store.redo()
    expect(cmd.redo).toHaveBeenCalledTimes(1)
    expect(store.canUndo).toBe(true)
    expect(store.canRedo).toBe(false)
  })

  it('caps the undo stack at 100 entries (oldest dropped)', () => {
    const store = useHistoryStore()
    for (let i = 0; i < 105; i++) {
      store.push(makeCmd(`cmd-${i}`))
    }
    expect(store.undoStack.length).toBe(100)
    expect(store.undoStack[0]?.label).toBe('cmd-5')
    expect(store.undoStack[99]?.label).toBe('cmd-104')
  })

  it('clear empties both stacks', () => {
    const store = useHistoryStore()
    store.push(makeCmd('a'))
    store.undo()
    store.clear()
    expect(store.canUndo).toBe(false)
    expect(store.canRedo).toBe(false)
  })

  it('popLast removes the most recent entry without running its undo', () => {
    const store = useHistoryStore()
    const cmd = makeCmd('a')
    store.push(cmd)
    const popped = store.popLast()
    expect(popped?.label).toBe('a')
    expect(cmd.undo).not.toHaveBeenCalled()
    expect(store.canUndo).toBe(false)
  })
})
