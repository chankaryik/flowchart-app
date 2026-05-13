<script setup lang="ts">
import { Background } from '@vue-flow/background'
import { Controls } from '@vue-flow/controls'
import { VueFlow, useVueFlow, type Node as VueFlowNode, type NodeChange } from '@vue-flow/core'
import { MiniMap } from '@vue-flow/minimap'
import { computed, nextTick, watch, watchEffect } from 'vue'
import { useRouter } from 'vue-router'

import { computeLayout } from '@/lib/layout'
import { nodeKey, useFlowStore } from '@/stores/flow'
import { useNodeEdges } from '@/composables/useNodeEdges'

import AddCommentNode from './nodes/AddCommentNode.vue'
import DateTimeConnectorNode from './nodes/DateTimeConnectorNode.vue'
import DateTimeNode from './nodes/DateTimeNode.vue'
import SendMessageNode from './nodes/SendMessageNode.vue'
import TriggerNode from './nodes/TriggerNode.vue'

// useNodesQuery() is called once at the FlowChartView level so the loading
// state can drive the header; the store this writes into is shared.
const store = useFlowStore()
const router = useRouter()
const edges = useNodeEdges()
const { fitView } = useVueFlow()

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

function onNodesChange(changes: NodeChange[]) {
  // Phase 4 only persists position deltas. Phase 8 adds throttling and
  // pushes a single history entry per drag-end.
  for (const change of changes) {
    if (change.type === 'position' && change.position != null) {
      store.positions[change.id] = { x: change.position.x, y: change.position.y }
    }
  }
}

function onNodeClick(event: { node: VueFlowNode }) {
  if (event.node.type === 'dateTimeConnector') return
  void router.push(`/node/${event.node.id}`)
}
</script>

<template>
  <VueFlow
    :nodes="vueFlowNodes"
    :edges="edges"
    :default-edge-options="{ type: 'smoothstep' }"
    :fit-view-on-init="true"
    :nodes-draggable="true"
    :nodes-connectable="false"
    :elements-selectable="true"
    class="h-full w-full bg-slate-50"
    @nodes-change="onNodesChange"
    @node-click="onNodeClick"
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
</template>
