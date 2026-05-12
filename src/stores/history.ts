import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

export type HistoryCommand = {
  label: string
  undo: () => void
  redo: () => void
}

const MAX_DEPTH = 100

export const useHistoryStore = defineStore('history', () => {
  const undoStack = ref<HistoryCommand[]>([])
  const redoStack = ref<HistoryCommand[]>([])

  const canUndo = computed(() => undoStack.value.length > 0)
  const canRedo = computed(() => redoStack.value.length > 0)

  function push(cmd: HistoryCommand): void {
    undoStack.value.push(cmd)
    if (undoStack.value.length > MAX_DEPTH) {
      undoStack.value.shift()
    }
    redoStack.value = []
  }

  function undo(): void {
    const cmd = undoStack.value.pop()
    if (cmd == null) return
    cmd.undo()
    redoStack.value.push(cmd)
  }

  function redo(): void {
    const cmd = redoStack.value.pop()
    if (cmd == null) return
    cmd.redo()
    undoStack.value.push(cmd)
  }

  function clear(): void {
    undoStack.value = []
    redoStack.value = []
  }

  function popLast(): HistoryCommand | undefined {
    return undoStack.value.pop()
  }

  return { undoStack, redoStack, canUndo, canRedo, push, undo, redo, clear, popLast }
})
