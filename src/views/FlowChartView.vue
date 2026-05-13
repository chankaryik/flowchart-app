<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import CreateNodeDialog from '@/components/flow/CreateNodeDialog.vue'
import FlowCanvas from '@/components/flow/FlowCanvas.vue'
import NodeDetailsDrawer from '@/components/drawer/NodeDetailsDrawer.vue'
import { useNodesQuery } from '@/queries/nodes'
import { useFlowStore } from '@/stores/flow'

const route = useRoute()
const router = useRouter()
const store = useFlowStore()

const query = useNodesQuery()
const createDialogOpen = ref(false)

const drawerNodeId = computed(() => {
  const raw = route.params.id
  if (raw == null) return null
  const value = Array.isArray(raw) ? raw[0] : raw
  return value == null || value === '' ? null : value
})

// Post-hydration guard. The router's beforeEnter handles the case when
// localStorage is already seeded; this watcher catches first-visit deep
// links where the store hadn't loaded yet at navigation time. Gating on
// `store.nodes.length` (not `query.isSuccess`) avoids a race where the
// success flag flips before the hydration watcher in useNodesQuery runs.
watch(
  [drawerNodeId, () => store.nodes.length],
  ([id, count]) => {
    if (id == null) return
    if (count === 0) return
    const node = store.getNodeById(id)
    if (node == null) {
      console.warn(`[FlowChartView] /node/${id} not found, redirecting to /`)
      void router.replace('/')
      return
    }
    if (node.type === 'dateTimeConnector') {
      console.warn(
        `[FlowChartView] /node/${id} is a connector (display-only), redirecting to /`,
      )
      void router.replace('/')
    }
  },
  { immediate: true },
)
</script>

<template>
  <div class="flex h-screen flex-col bg-slate-50 text-slate-900">
    <header
      class="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-3"
    >
      <div class="flex items-baseline gap-3">
        <h1 class="text-base font-semibold tracking-tight">Flow Chart</h1>
        <span v-if="query.isPending.value" class="text-xs text-slate-500">Loading…</span>
        <span v-else-if="query.isError.value" class="text-xs text-red-600">
          Failed to load payload
        </span>
        <span v-else class="text-xs text-slate-500">{{ store.nodes.length }} nodes</span>
      </div>
      <button
        type="button"
        class="inline-flex items-center gap-1.5 rounded-md bg-slate-900 px-3 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-slate-800 disabled:opacity-50"
        :disabled="query.isPending.value || query.isError.value"
        data-testid="create-node-button"
        @click="createDialogOpen = true"
      >
        + Create Node
      </button>
    </header>

    <main class="relative flex-1 overflow-hidden">
      <FlowCanvas class="absolute inset-0" />
      <NodeDetailsDrawer />
    </main>
    <CreateNodeDialog v-model:open="createDialogOpen" />
  </div>
</template>
