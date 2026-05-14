import { useEventListener } from '@vueuse/core'

import { isEditableTarget } from '@/lib/dom'
import { useHistoryStore } from '@/stores/history'

export function useFlowHistory(): void {
  const history = useHistoryStore()

  useEventListener(window, 'keydown', (event: KeyboardEvent) => {
    if (isEditableTarget(event.target)) return

    const key = event.key.toLowerCase()
    const isUndoRedoKey = key === 'z' && (event.ctrlKey || event.metaKey) && !event.altKey
    if (isUndoRedoKey) {
      event.preventDefault()
      if (event.shiftKey) history.redo()
      else history.undo()
      return
    }

    const isWindowsRedo = key === 'y' && event.ctrlKey && !event.metaKey && !event.altKey
    if (isWindowsRedo && !event.shiftKey) {
      event.preventDefault()
      history.redo()
    }
  })
}
