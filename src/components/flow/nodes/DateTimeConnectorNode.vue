<script setup lang="ts">
import { Handle, Position } from '@vue-flow/core'

import type { DateTimeConnectorNode } from '@/lib/types'

// Display-only per CLAUDE.md §8.1 — no click handlers, no router push,
// not exposed via Create Node, skipped by keyboard navigation.
defineProps<{ id: string; data: DateTimeConnectorNode }>()
</script>

<template>
  <div
    class="w-[220px] rounded-md border px-3 py-2 text-center text-sm shadow-sm"
    :class="
      data.data.connectorType === 'success'
        ? 'border-emerald-300 bg-emerald-50 text-emerald-900'
        : 'border-rose-300 bg-rose-50 text-rose-900'
    "
  >
    <Handle type="target" :position="Position.Top" />
    <p class="text-[10px] font-semibold uppercase tracking-wide opacity-70">
      {{ data.data.connectorType }}
    </p>
    <p class="font-medium">{{ data.name }}</p>
    <Handle type="source" :position="Position.Bottom" />
  </div>
</template>
