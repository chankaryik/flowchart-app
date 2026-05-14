<script setup lang="ts">
import { Background } from '@vue-flow/background'
import { Controls } from '@vue-flow/controls'
import { VueFlow, useVueFlow, type Node as VueFlowNode, type NodeDragEvent } from '@vue-flow/core'
import { MiniMap } from '@vue-flow/minimap'
import { useDebounceFn, useResizeObserver, useThrottleFn } from '@vueuse/core'
import { computed, nextTick, ref, watch, watchEffect } from 'vue'
import { useRouter } from 'vue-router'

import { computeLayout } from '@/lib/layout'
import { useMoveNode, type SecondaryMove } from '@/queries/nodes'
import { nodeKey, type Position, useFlowStore } from '@/stores/flow'
import { useNodeEdges } from '@/composables/useNodeEdges'
import { useTheme } from '@/composables/useTheme'

import AddCommentNode from './nodes/AddCommentNode.vue'
import DateTimeConnectorNode from './nodes/DateTimeConnectorNode.vue'
import DateTimeNode from './nodes/DateTimeNode.vue'
import SendMessageNode from './nodes/SendMessageNode.vue'
import TriggerNode from './nodes/TriggerNode.vue'

const store = useFlowStore()
const router = useRouter()
const edges = useNodeEdges()
const { fitView } = useVueFlow()
const moveMutation = useMoveNode()
const { resolved: resolvedTheme } = useTheme()
// Background pattern uses fixed SVG fill colors that CSS variables can't
// reach, so swap the dot color when the resolved theme flips.
const backgroundPatternColor = computed(() =>
  resolvedTheme.value === 'dark' ? '#475569' : '#cbd5e1',
)

const DRAG_THROTTLE_MS = 30

// Per-drag state: positions captured at drag-start so drag-stop can build
// a single history entry with before→after for the primary + any connectors.
let dragStart: Position | null = null
let connectorStart: Record<string, Position> = {}

// fit-view-on-init fires while the store is still empty (hydration is async);
// re-fit on the first non-empty render so the seed graph lands inside the viewport.
let fittedOnce = false
watch(
  () => store.nodes.length,
  async (count) => {
    if (count === 0 || fittedOnce) return
    fittedOnce = true
    await nextTick()
    fitView({ padding: 0.2 })
  },
  { immediate: true },
)

// Vue Flow tracks container dimensions internally but does not refit on
// resize — without this, shrinking the window to mobile leaves nodes at
// their old absolute positions until the user pans or refreshes.
const canvasRoot = ref<HTMLElement | null>(null)
const refitOnResize = useDebounceFn(() => {
  if (store.nodes.length === 0) return
  fitView({ padding: 0.2 })
}, 150)
useResizeObserver(canvasRoot, refitOnResize)

// Seed positions when nodes are present but some/all lack a layout entry.
// Idempotent: re-runs only while at least one node is missing a position.
watchEffect(() => {
  if (store.nodes.length === 0) return
  const missingAny = store.nodes.some((node) => store.positions[nodeKey(node.id)] == null)
  if (!missingAny) return
  const layout = computeLayout(store.nodes)
  const missing: Record<string, Position> = {}
  for (const node of store.nodes) {
    const key = nodeKey(node.id)
    if (store.positions[key] == null) {
      const position = layout[key]
      if (position != null) missing[key] = position
    }
  }
  store.setPositions(missing)
})

const vueFlowNodes = computed<VueFlowNode[]>(() =>
  store.nodes.map((node) => {
    const key = nodeKey(node.id)
    const position = store.positions[key] ?? { x: 0, y: 0 }
    return {
      id: key,
      type: node.type,
      position,
      data: node,
    }
  }),
)

function onNodeClick(event: { node: VueFlowNode }) {
  if (event.node.type === 'dateTimeConnector') return
  void router.push(`/node/${event.node.id}`)
}

function applyDrag(event: NodeDragEvent): void {
  const key = nodeKey(event.node.id)
  const next: Position = { x: event.node.position.x, y: event.node.position.y }
  store.setPosition(event.node.id, next)
  if (dragStart == null) return
  const dx = next.x - dragStart.x
  const dy = next.y - dragStart.y
  for (const [connectorKey, start] of Object.entries(connectorStart)) {
    if (connectorKey === key) continue
    store.positions[connectorKey] = { x: start.x + dx, y: start.y + dy }
  }
}

function onNodeDragStart(event: NodeDragEvent): void {
  const key = nodeKey(event.node.id)
  dragStart = {
    ...(store.positions[key] ?? { x: event.node.position.x, y: event.node.position.y }),
  }
  connectorStart = {}
  const flow = store.getNodeById(event.node.id)
  if (flow?.type === 'dateTime') {
    for (const child of store.getChildren(event.node.id)) {
      if (child.type !== 'dateTimeConnector') continue
      const childKey = nodeKey(child.id)
      const pos = store.positions[childKey]
      if (pos != null) connectorStart[childKey] = { ...pos }
    }
  }
}

const onNodeDrag = useThrottleFn(applyDrag, DRAG_THROTTLE_MS, true, true)

function onNodeDragStop(event: NodeDragEvent): void {
  // Apply the final position immediately, bypassing the throttle, so the
  // history entry below sees the true drag end-point rather than a stale
  // sample from the last throttle window.
  applyDrag(event)

  const key = nodeKey(event.node.id)
  const finalPos: Position = { x: event.node.position.x, y: event.node.position.y }
  const start = dragStart
  const connectorStartSnapshot = connectorStart
  dragStart = null
  connectorStart = {}

  // Skip history when the gesture didn't actually move anything (a stray
  // click that fired drag-start/stop without movement).
  if (start != null && start.x === finalPos.x && start.y === finalPos.y) {
    return
  }

  const dx = start != null ? finalPos.x - start.x : 0
  const dy = start != null ? finalPos.y - start.y : 0
  const secondary: SecondaryMove[] = []
  for (const [connectorKey, from] of Object.entries(connectorStartSnapshot)) {
    if (connectorKey === key) continue
    secondary.push({
      id: connectorKey,
      from,
      to: { x: from.x + dx, y: from.y + dy },
    })
  }

  void moveMutation.mutateAsync({
    id: event.node.id,
    position: finalPos,
    previousPosition: start ?? undefined,
    secondary: secondary.length > 0 ? secondary : undefined,
  })
}
</script>

<template>
  <div ref="canvasRoot" class="relative h-full w-full">
    <VueFlow
      :nodes="vueFlowNodes"
      :edges="edges"
      :default-edge-options="{ type: 'smoothstep' }"
      :fit-view-on-init="true"
      :nodes-draggable="true"
      :nodes-connectable="false"
      :elements-selectable="true"
      class="h-full w-full bg-background"
      @node-click="onNodeClick"
      @node-drag-start="onNodeDragStart"
      @node-drag="onNodeDrag"
      @node-drag-stop="onNodeDragStop"
    >
      <template #node-trigger="nodeProps">
        <TriggerNode v-bind="nodeProps" />
      </template>
      <template #node-sendMessage="nodeProps">
        <SendMessageNode v-bind="nodeProps" />
      </template>
      <template #node-dateTime="nodeProps">
        <DateTimeNode v-bind="nodeProps" />
      </template>
      <template #node-dateTimeConnector="nodeProps">
        <DateTimeConnectorNode v-bind="nodeProps" />
      </template>
      <template #node-addComment="nodeProps">
        <AddCommentNode v-bind="nodeProps" />
      </template>

      <Background :pattern-color="backgroundPatternColor" :gap="20" />
      <MiniMap pannable zoomable class="hidden md:block" />
      <Controls />
    </VueFlow>
  </div>
</template>
