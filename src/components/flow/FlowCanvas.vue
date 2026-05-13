<script setup lang="ts">
import { Background } from '@vue-flow/background'
import { Controls } from '@vue-flow/controls'
import {
  VueFlow,
  useVueFlow,
  type Node as VueFlowNode,
  type NodeDragEvent,
} from '@vue-flow/core'
import { MiniMap } from '@vue-flow/minimap'
import { AlertTriangle, RefreshCw, Sparkles } from 'lucide-vue-next'
import { useThrottleFn } from '@vueuse/core'
import { computed, nextTick, ref, watch, watchEffect } from 'vue'
import { useRouter } from 'vue-router'
import { toast } from 'vue-sonner'

import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { computeLayout } from '@/lib/layout'
import { resetNodes } from '@/lib/payload-adapter'
import { useNodesQuery, useMoveNode, type SecondaryMove } from '@/queries/nodes'
import { NODES_QUERY_KEY } from '@/queries/client'
import { nodeKey, type Position, useFlowStore } from '@/stores/flow'
import { useHistoryStore } from '@/stores/history'
import { useNodeEdges } from '@/composables/useNodeEdges'
import { useQueryClient } from '@tanstack/vue-query'

import AddCommentNode from './nodes/AddCommentNode.vue'
import DateTimeConnectorNode from './nodes/DateTimeConnectorNode.vue'
import DateTimeNode from './nodes/DateTimeNode.vue'
import SendMessageNode from './nodes/SendMessageNode.vue'
import TriggerNode from './nodes/TriggerNode.vue'

// FlowChartView also calls useNodesQuery for the header chip; calling it here
// gives this component direct access to the loading/error state without prop
// drilling. Vue Query dedupes by queryKey so this is cheap.
const store = useFlowStore()
const router = useRouter()
const edges = useNodeEdges()
const { fitView } = useVueFlow()
const moveMutation = useMoveNode()
const query = useNodesQuery()
const queryClient = useQueryClient()
const history = useHistoryStore()
const seeding = ref(false)

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

// Seed positions when nodes are present but some/all lack a layout entry.
// Idempotent: re-runs only while at least one node is missing a position.
watchEffect(() => {
  if (store.nodes.length === 0) return
  const missingAny = store.nodes.some((node) => store.positions[nodeKey(node.id)] == null)
  if (!missingAny) return
  store.setPositions(computeLayout(store.nodes))
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
  dragStart = { ...(store.positions[key] ?? { x: event.node.position.x, y: event.node.position.y }) }
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
    label: 'Move node',
  })
}

const showLoading = computed(
  () => query.isPending.value && store.nodes.length === 0,
)
const showError = computed(() => query.isError.value && store.nodes.length === 0)
// Empty state covers the tampered-localStorage case (CLAUDE.md Phase 11): the
// query succeeded but produced an empty array, or every node has been deleted.
const showEmpty = computed(
  () =>
    !query.isPending.value && !query.isError.value && store.nodes.length === 0,
)

async function onRetry(): Promise<void> {
  try {
    await query.refetch()
    toast.success('Reloaded')
  } catch (error) {
    toast.error('Reload failed', {
      description: error instanceof Error ? error.message : undefined,
    })
  }
}

async function onSeedDefault(): Promise<void> {
  seeding.value = true
  try {
    const seed = await resetNodes()
    store.hydrate(seed)
    store.clearPositions()
    history.clear()
    queryClient.setQueryData(NODES_QUERY_KEY, seed)
    toast.success('Default payload restored')
  } catch (error) {
    toast.error('Failed to restore default payload', {
      description: error instanceof Error ? error.message : undefined,
    })
  } finally {
    seeding.value = false
  }
}
</script>

<template>
  <div class="relative h-full w-full">
    <VueFlow
      :nodes="vueFlowNodes"
      :edges="edges"
      :default-edge-options="{ type: 'smoothstep' }"
      :fit-view-on-init="true"
      :nodes-draggable="true"
      :nodes-connectable="false"
      :elements-selectable="true"
      class="h-full w-full bg-slate-50"
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

      <Background pattern-color="#cbd5e1" :gap="20" />
      <MiniMap pannable zoomable />
      <Controls />
    </VueFlow>

    <div
      v-if="showLoading"
      class="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-slate-50/80 backdrop-blur-sm"
      data-testid="canvas-loading"
      role="status"
      aria-live="polite"
    >
      <div class="flex w-72 flex-col gap-3 rounded-lg border border-border bg-white p-4 shadow-sm">
        <Skeleton class="h-4 w-24" />
        <Skeleton class="h-16 w-full" />
        <Skeleton class="h-16 w-full" />
        <Skeleton class="h-4 w-32" />
      </div>
      <p class="text-xs text-muted-foreground">Loading flow chart…</p>
    </div>

    <div
      v-else-if="showError"
      class="absolute inset-0 z-10 flex items-center justify-center bg-slate-50/90 backdrop-blur-sm"
      data-testid="canvas-error"
      role="alert"
    >
      <div class="flex max-w-sm flex-col items-center gap-3 rounded-lg border border-destructive/30 bg-white p-6 text-center shadow-sm">
        <AlertTriangle class="size-6 text-destructive" aria-hidden="true" />
        <div>
          <p class="text-sm font-semibold">Could not load the flow chart</p>
          <p class="mt-1 text-xs text-muted-foreground">
            {{ query.error.value instanceof Error ? query.error.value.message : 'The payload failed to load.' }}
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          :disabled="query.isFetching.value"
          data-testid="canvas-retry"
          @click="onRetry"
        >
          <RefreshCw class="size-3" />
          {{ query.isFetching.value ? 'Retrying…' : 'Retry' }}
        </Button>
      </div>
    </div>

    <div
      v-else-if="showEmpty"
      class="absolute inset-0 z-10 flex items-center justify-center bg-slate-50/90"
      data-testid="canvas-empty"
    >
      <div class="flex max-w-sm flex-col items-center gap-3 rounded-lg border border-border bg-white p-6 text-center shadow-sm">
        <Sparkles class="size-6 text-muted-foreground" aria-hidden="true" />
        <div>
          <p class="text-sm font-semibold">The canvas is empty</p>
          <p class="mt-1 text-xs text-muted-foreground">
            Restore the original payload to bring back the seed flow chart.
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          :disabled="seeding"
          data-testid="canvas-seed-default"
          @click="onSeedDefault"
        >
          {{ seeding ? 'Restoring…' : 'Reset to default payload' }}
        </Button>
      </div>
    </div>
  </div>
</template>
