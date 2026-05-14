import { useEventListener } from '@vueuse/core'
import { watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { isEditableTarget } from '@/lib/dom'
import type { NodeId } from '@/lib/types'
import { nodeKey, useFlowStore } from '@/stores/flow'

export type UseNodeKeyboardOptions = {
  onHelp: () => void
}

/**
 * Wires keyboard accessibility for the flow chart:
 *
 *   Tab / Shift+Tab     → cycle focus through nodes in array order
 *   Arrow Right / Down  → next node
 *   Arrow Left / Up     → previous node
 *   Enter               → open drawer for the focused node
 *   Esc                 → close the drawer
 *   ?                   → open the shortcut help dialog
 *
 * dateTimeConnector nodes are excluded from navigation (display-only).
 */
export function useNodeKeyboard(options: UseNodeKeyboardOptions): void {
  const store = useFlowStore()
  const router = useRouter()
  const route = useRoute()

  function navigableIds(): NodeId[] {
    return store.nodes
      .filter((n) => n.type !== 'dateTimeConnector')
      .map((n) => n.id)
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
  // router back — there's no Sheet trigger to fall back to since we navigated
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

/* ===========================================================================
 * OLD IMPLEMENTATION — kept (commented out) for A/B comparison after refactor.
 * Implements 2D spatial arrow-key navigation with weighted distance metrics
 * and per-row Tab grouping. REQUIREMENTS.md only asked for "keyboard
 * accessibility for selecting nodes and opening the details drawer", so the
 * simpler linear traversal above replaces it. Safe to delete once the new
 * implementation has been compared against this one.
 *
 * (Inner JSDoc closers have been changed from STAR-SLASH to STAR-SPACE-SLASH
 * so this block comment stays well-formed; restore them if uncommenting.)
 * ===========================================================================

import { watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { useGlobalKeydown } from '@/composables/useGlobalKeydown'
import type { FlowNode, NodeId } from '@/lib/types'
import { nodeKey, useFlowStore, type Position } from '@/stores/flow'

export type ArrowDirection = 'up' | 'down' | 'left' | 'right'

// Vertical tolerance for left/right sibling discovery and tab grouping by row.
// A row of nodes laid out by computeLayout shares the same y; in practice they
// can drift by a few pixels after drag, so we group within ROW_TOLERANCE.
const ROW_TOLERANCE = 24

/**
 * The set of node IDs that participate in keyboard navigation.
 * Connectors are display-only per CLAUDE.md §8.1, so they're excluded from
 * Tab and Arrow targets (their tabindex is also -1 in the component).
 * /
export function navigableNodeIds(nodes: FlowNode[]): NodeId[] {
  const out: NodeId[] = []
  for (const node of nodes) {
    if (node.type === 'dateTimeConnector') continue
    out.push(node.id)
  }
  return out
}

/**
 * Tab order: top-down rows, left-right within each row. Nodes lacking a
 * position fall to the end so they don't break the cycle.
 * /
export function computeTabOrder(
  ids: NodeId[],
  positions: Record<string, Position>,
): NodeId[] {
  const placed: Array<{ id: NodeId; pos: Position }> = []
  const unplaced: NodeId[] = []
  for (const id of ids) {
    const pos = positions[nodeKey(id)]
    if (pos == null) unplaced.push(id)
    else placed.push({ id, pos })
  }
  placed.sort((a, b) => {
    if (Math.abs(a.pos.y - b.pos.y) > ROW_TOLERANCE) return a.pos.y - b.pos.y
    return a.pos.x - b.pos.x
  })
  return [...placed.map((e) => e.id), ...unplaced]
}

/**
 * Closest navigable node in the requested direction, by 2D position.
 * `up`/`down` weight horizontal drift; `left`/`right` weight vertical drift,
 * so navigation feels axis-aligned rather than diagonal.
 * /
export function findAdjacent(
  fromId: NodeId,
  candidateIds: NodeId[],
  positions: Record<string, Position>,
  direction: ArrowDirection,
): NodeId | null {
  const fromKey = nodeKey(fromId)
  const from = positions[fromKey]
  if (from == null) return null

  let best: { id: NodeId; dist: number } | null = null
  for (const id of candidateIds) {
    const key = nodeKey(id)
    if (key === fromKey) continue
    const pos = positions[key]
    if (pos == null) continue

    const dx = pos.x - from.x
    const dy = pos.y - from.y

    let dist = Infinity
    switch (direction) {
      case 'up':
        if (dy >= -ROW_TOLERANCE) continue
        dist = Math.abs(dy) + Math.abs(dx) * 0.5
        break
      case 'down':
        if (dy <= ROW_TOLERANCE) continue
        dist = Math.abs(dy) + Math.abs(dx) * 0.5
        break
      case 'left':
        if (dx >= 0) continue
        dist = Math.abs(dx) + Math.abs(dy) * 2
        break
      case 'right':
        if (dx <= 0) continue
        dist = Math.abs(dx) + Math.abs(dy) * 2
        break
    }

    if (best == null || dist < best.dist) {
      best = { id, dist }
    }
  }
  return best?.id ?? null
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  if (target.isContentEditable) return true
  const ce = target.getAttribute('contenteditable')
  if (ce != null && ce !== 'false') return true
  const tag = target.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT'
}

function activeFlowNodeId(): string | null {
  const active = typeof document !== 'undefined' ? document.activeElement : null
  if (!(active instanceof HTMLElement)) return null
  const direct = active.getAttribute('data-flow-node-id')
  if (direct != null && direct !== '') return direct
  const ancestor = active.closest('[data-flow-node-id]')
  if (ancestor instanceof HTMLElement) {
    const id = ancestor.getAttribute('data-flow-node-id')
    if (id != null && id !== '') return id
  }
  return null
}

function focusFlowNode(id: NodeId | string | null): boolean {
  if (id == null) return false
  if (typeof document === 'undefined') return false
  // Iterate rather than build a CSS selector — IDs can contain characters
  // (commas, quotes from future ID schemes) that need fragile escaping, and
  // jsdom doesn't always expose CSS.escape.
  const key = String(id)
  const matches = document.querySelectorAll('[data-flow-node-id]')
  for (const candidate of Array.from(matches)) {
    if (candidate.getAttribute('data-flow-node-id') === key) {
      if (candidate instanceof HTMLElement) {
        candidate.focus()
        return true
      }
    }
  }
  return false
}

export type UseNodeKeyboardOptions = {
  onHelp: () => void
}

/**
 * Wires keyboard accessibility for the flow chart per CLAUDE.md §8.5:
 *
 *   Tab / Shift+Tab → cycle focus through nodes in graph order
 *   Arrow keys      → move focus to the closest adjacent node
 *   Enter           → open drawer for the focused node
 *   Esc             → close the drawer (when one is open)
 *   ?               → open the shortcut help dialog
 *
 * Connectors (dateTimeConnector) are skipped entirely — they have tabindex=-1
 * on the DOM side AND are filtered out of the navigation set here.
 * /
export function useNodeKeyboard(options: UseNodeKeyboardOptions): void {
  const store = useFlowStore()
  const router = useRouter()
  const route = useRoute()

  function handleTab(event: KeyboardEvent): void {
    const fromId = activeFlowNodeId()
    // Tab from outside the graph falls through to native browser handling
    // so users can still reach the Create New Node button etc.
    if (fromId == null) return
    const order = computeTabOrder(navigableNodeIds(store.nodes), store.positions)
    if (order.length === 0) return
    const idx = order.findIndex((id) => nodeKey(id) === fromId)
    if (idx < 0) return
    const nextIdx = event.shiftKey
      ? (idx - 1 + order.length) % order.length
      : (idx + 1) % order.length
    event.preventDefault()
    focusFlowNode(order[nextIdx] ?? null)
  }

  function handleArrow(event: KeyboardEvent, direction: ArrowDirection): void {
    const fromId = activeFlowNodeId()
    if (fromId == null) return
    event.preventDefault()
    const next = findAdjacent(
      fromId,
      navigableNodeIds(store.nodes),
      store.positions,
      direction,
    )
    if (next != null) focusFlowNode(next)
  }

  function handleEnter(event: KeyboardEvent): void {
    const fromId = activeFlowNodeId()
    if (fromId == null) return
    event.preventDefault()
    void router.push(`/node/${fromId}`)
  }

  function handleEscape(event: KeyboardEvent): void {
    // Only close the drawer; do not steal Esc from a closed-drawer canvas.
    // Shadcn Sheet also closes on Esc natively — this path keeps behavior
    // consistent if focus is on a non-input element inside the drawer.
    const id = route.params.id
    if (id == null || id === '') return
    event.preventDefault()
    void router.push('/')
  }

  function onKeyDown(event: KeyboardEvent): void {
    // Esc inside an input should still close the drawer (the native Sheet
    // handler covers this too — we mirror it for non-Sheet contexts later).
    if (event.key === 'Escape') {
      handleEscape(event)
      return
    }
    // Other shortcuts stay out of editable fields so we don't fight the IME.
    if (isEditableTarget(event.target)) return
    if (event.ctrlKey || event.metaKey || event.altKey) return

    switch (event.key) {
      case 'Tab':
        handleTab(event)
        return
      case 'ArrowUp':
        handleArrow(event, 'up')
        return
      case 'ArrowDown':
        handleArrow(event, 'down')
        return
      case 'ArrowLeft':
        handleArrow(event, 'left')
        return
      case 'ArrowRight':
        handleArrow(event, 'right')
        return
      case 'Enter':
        handleEnter(event)
        return
      case '?':
        event.preventDefault()
        options.onHelp()
        return
    }
  }

  // When the drawer closes via router back, return focus to the previously
  // active node so the keyboard journey stays continuous.
  let lastFocusedId: string | null = null
  watch(
    () => route.params.id,
    (id, prevId) => {
      if (id != null && id !== '' && (prevId == null || prevId === '')) {
        lastFocusedId = activeFlowNodeId()
        return
      }
      if ((id == null || id === '') && prevId != null && prevId !== '') {
        if (lastFocusedId != null) {
          // Defer to next tick so the drawer's focus-return doesn't race us.
          queueMicrotask(() => {
            focusFlowNode(lastFocusedId)
          })
        }
      }
    },
  )

  useGlobalKeydown(onKeyDown)
}

=========================================================================== */
