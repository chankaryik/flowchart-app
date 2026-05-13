import { onBeforeUnmount, onMounted } from 'vue'

import { useHistoryStore } from '@/stores/history'

function isMac(): boolean {
  if (typeof navigator === 'undefined') return false
  const platform = navigator.platform ?? ''
  if (platform !== '') return /Mac|iPod|iPhone|iPad/.test(platform)
  return /Mac|iPod|iPhone|iPad/.test(navigator.userAgent ?? '')
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  if (target.isContentEditable) return true
  // jsdom's isContentEditable getter doesn't always reflect the attribute; check it directly.
  const ce = target.getAttribute('contenteditable')
  if (ce != null && ce !== 'false') return true
  const tag = target.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true
  return false
}

export function useFlowHistory(): void {
  const history = useHistoryStore()
  const mac = isMac()

  function onKeyDown(event: KeyboardEvent): void {
    // Browsers handle in-field undo/redo themselves; intercepting here would
    // double-fire (undo the canvas AND the text edit) and surprise users.
    if (isEditableTarget(event.target)) return

    const primary = mac ? event.metaKey : event.ctrlKey
    if (!primary) return
    if (event.altKey) return

    const key = event.key.toLowerCase()
    if (key === 'z') {
      event.preventDefault()
      if (event.shiftKey) history.redo()
      else history.undo()
      return
    }
    // Windows convention: Ctrl+Y is a second redo binding. Not standard on macOS.
    if (!mac && key === 'y' && !event.shiftKey) {
      event.preventDefault()
      history.redo()
    }
  }

  // Capture phase: keydown reaches us before any descendant — including reka-ui
  // portals (Sheet, AlertDialog) that can stopPropagation in their focus traps
  // and would otherwise eat Ctrl+Shift+Z.
  onMounted(() => {
    window.addEventListener('keydown', onKeyDown, true)
  })

  onBeforeUnmount(() => {
    window.removeEventListener('keydown', onKeyDown, true)
  })
}
