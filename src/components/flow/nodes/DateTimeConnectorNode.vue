<script setup lang="ts">
import { Handle, Position } from '@vue-flow/core'
import { CheckCircle2, XCircle } from 'lucide-vue-next'
import { computed } from 'vue'

import AddNodeButton from '@/components/flow/AddNodeButton.vue'
import type { DateTimeConnectorNode as DateTimeConnectorNodeShape } from '@/lib/types'

// Display-only per CLAUDE.md §8.1. Do NOT wire click/keyboard handlers, do NOT
// route to /node/<connector-id>, do NOT expose in Create Node. Skipped by
// keyboard navigation (Phase 10). FlowCanvas already filters connector clicks
// from router-push; FlowChartView's guard redirects /node/<connector-id> to /.
const props = defineProps<{ id: string; data: DateTimeConnectorNodeShape }>()

const isSuccess = computed(() => props.data.data.connectorType === 'success')
</script>

<template>
  <div
    class="connector-node relative inline-flex w-[140px] items-center justify-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold uppercase tracking-wide shadow-sm"
    :class="
      isSuccess
        ? 'border-emerald-400 bg-emerald-100 text-emerald-800'
        : 'border-rose-400 bg-rose-100 text-rose-800'
    "
    data-node-type="dateTimeConnector"
    :data-connector-type="data.data.connectorType"
    aria-hidden="false"
    tabindex="-1"
  >
    <Handle type="target" :position="Position.Top" />
    <CheckCircle2 v-if="isSuccess" class="size-3.5" aria-hidden="true" />
    <XCircle v-else class="size-3.5" aria-hidden="true" />
    <span>{{ isSuccess ? 'Success' : 'Failure' }}</span>
    <Handle type="source" :position="Position.Bottom" />
    <AddNodeButton :parent-id="data.id" />
  </div>
</template>
