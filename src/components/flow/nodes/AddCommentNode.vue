<script setup lang="ts">
import { Handle, Position } from '@vue-flow/core'

import type { AddCommentNode } from '@/lib/types'

defineProps<{ id: string; data: AddCommentNode }>()
</script>

<template>
  <div
    class="w-[220px] rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm shadow-sm"
  >
    <Handle type="target" :position="Position.Top" />
    <p class="text-[10px] font-semibold uppercase tracking-wide text-amber-700">Comment</p>
    <p class="font-medium text-amber-900">{{ data.name }}</p>
    <Handle type="source" :position="Position.Bottom" />
  </div>
</template>
