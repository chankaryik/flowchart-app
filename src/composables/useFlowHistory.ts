import { onKeyStroke } from '@vueuse/core'

import { isEditableTarget } from '@/lib/dom'
import { useHistoryStore } from '@/stores/history'

export function useFlowHistory(): void {
  const history = useHistoryStore()

  // Ctrl+Z / Cmd+Z to undo, +Shift to redo. Skipped inside editable fields so
  // the browser's native text undo still works.
  onKeyStroke('z', (event) => {
    if (isEditableTarget(event.target)) return
    if (!(event.ctrlKey || event.metaKey) || event.altKey) return
    event.preventDefault()
    if (event.shiftKey) history.redo()
    else history.undo()
  })

  // Windows convention: Ctrl+Y is a second redo binding.
  onKeyStroke('y', (event) => {
    if (isEditableTarget(event.target)) return
    if (!event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return
    event.preventDefault()
    history.redo()
  })
}
