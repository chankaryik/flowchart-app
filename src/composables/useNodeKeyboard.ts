import { useEventListener } from '@vueuse/core'
import { watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { isEditableTarget } from '@/lib/dom'
import type { FlowNode, NodeId } from '@/lib/types'
import { nodeKey, useFlowStore } from '@/stores/flow'

export type UseNodeKeyboardOptions = {
  onHelp: () => void
}

/**
 * Wires keyboard accessibility for the flow chart:
 *
 *   Tab / Shift+Tab     -> cycle focus through nodes in graph order
 *   Arrow Right / Down  -> next node in graph order
 *   Arrow Left / Up     -> previous node in graph order
 *   Enter               -> open drawer for the focused node
 *   Esc                 -> close the drawer
 *   ?                   -> open the shortcut help dialog
 *
 * dateTimeConnector nodes are excluded from navigation (display-only).
 */
export function useNodeKeyboard(options: UseNodeKeyboardOptions): void {
  const store = useFlowStore()
  const router = useRouter()
  const route = useRoute()

  function navigableIds(): NodeId[] {
    const byParent = new Map<string, FlowNode[]>()
    const idSet = new Set(store.nodes.map((node) => nodeKey(node.id)))

    for (const node of store.nodes) {
      const parentKey = nodeKey(node.parentId)
      const siblings = byParent.get(parentKey) ?? []
      siblings.push(node)
      byParent.set(parentKey, siblings)
    }

    const out: NodeId[] = []
    const visit = (node: FlowNode): void => {
      if (node.type !== 'dateTimeConnector') out.push(node.id)
      for (const child of byParent.get(nodeKey(node.id)) ?? []) {
        visit(child)
      }
    }

    for (const root of store.nodes) {
      if (!idSet.has(nodeKey(root.parentId))) visit(root)
    }
    return out
  }

  function activeFlowNodeId(): string | null {
    const el = typeof document !== 'undefined' ? document.activeElement : null
    if (!(el instanceof HTMLElement)) return null
    const ancestor = el.closest('[data-flow-node-id]')
    if (!(ancestor instanceof HTMLElement)) return null
    const id = ancestor.getAttribute('data-flow-node-id')
    return id != null && id !== '' ? id : null
  }

  function focusFlowNode(id: NodeId | null): void {
    if (id == null || typeof document === 'undefined') return
    const key = String(id)
    for (const candidate of document.querySelectorAll('[data-flow-node-id]')) {
      if (candidate.getAttribute('data-flow-node-id') === key && candidate instanceof HTMLElement) {
        candidate.focus()
        return
      }
    }
  }

  function step(delta: 1 | -1): void {
    const order = navigableIds()
    if (order.length === 0) return
    const current = activeFlowNodeId()
    if (current == null) {
      focusFlowNode(order[0] ?? null)
      return
    }
    const idx = order.findIndex((id) => nodeKey(id) === current)
    if (idx < 0) {
      focusFlowNode(order[0] ?? null)
      return
    }
    const nextIdx = (idx + delta + order.length) % order.length
    focusFlowNode(order[nextIdx] ?? null)
  }

  // Capture phase: reach the handler before reka-ui portals (Sheet,
  // AlertDialog) stopPropagation inside their focus traps.
  useEventListener(
    window,
    'keydown',
    (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        const id = route.params.id
        if (id != null && id !== '') {
          event.preventDefault()
          void router.push('/')
        }
        return
      }
      if (isEditableTarget(event.target)) return
      if (event.ctrlKey || event.metaKey || event.altKey) return

      switch (event.key) {
        case 'Tab':
          if (activeFlowNodeId() == null) return
          event.preventDefault()
          step(event.shiftKey ? -1 : 1)
          return
        case 'ArrowRight':
        case 'ArrowDown':
          if (activeFlowNodeId() == null) return
          event.preventDefault()
          step(1)
          return
        case 'ArrowLeft':
        case 'ArrowUp':
          if (activeFlowNodeId() == null) return
          event.preventDefault()
          step(-1)
          return
        case 'Enter': {
          const id = activeFlowNodeId()
          if (id == null) return
          event.preventDefault()
          void router.push(`/node/${id}`)
          return
        }
        case '?':
          event.preventDefault()
          options.onHelp()
          return
      }
    },
    { capture: true },
  )

  // Restore focus to the previously focused node when the drawer closes via
  // router back; there's no Sheet trigger to fall back to since we navigated
  // via URL.
  let lastFocusedId: string | null = null
  watch(
    () => route.params.id,
    (id, prevId) => {
      const opened = id != null && id !== '' && (prevId == null || prevId === '')
      const closed = (id == null || id === '') && prevId != null && prevId !== ''
      if (opened) {
        lastFocusedId = activeFlowNodeId()
      } else if (closed && lastFocusedId != null) {
        queueMicrotask(() => focusFlowNode(lastFocusedId))
      }
    },
  )
}
