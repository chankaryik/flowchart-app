<script setup lang="ts">
import { Handle, Position } from '@vue-flow/core'

import type { SendMessageNode } from '@/lib/types'

defineProps<{ id: string; data: SendMessageNode }>()
</script>

<template>
  <div
    class="w-[220px] rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm"
  >
    <Handle type="target" :position="Position.Top" />
    <p class="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
      Send Message
    </p>
    <p class="font-medium text-slate-900">{{ data.name }}</p>
    <Handle type="source" :position="Position.Bottom" />
  </div>
</template>
