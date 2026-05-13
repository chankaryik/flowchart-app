<script setup lang="ts">
import { Handle, Position } from '@vue-flow/core'
import { Clock } from 'lucide-vue-next'
import { computed } from 'vue'

import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { dayLabel, humanizeKey, summarizeBusinessHours } from '@/lib/format'
import type { DateTimeNode as DateTimeNodeShape } from '@/lib/types'

const props = defineProps<{ id: string; data: DateTimeNodeShape }>()

const summary = computed(() =>
  summarizeBusinessHours(props.data.data.times, props.data.data.timezone),
)
const actionLabel = computed(() => humanizeKey(props.data.data.action))
</script>

<template>
  <Tooltip>
    <TooltipTrigger as-child>
      <Card
        class="node-card w-[220px] gap-0 border-amber-300 bg-white py-0 shadow-sm"
        data-node-type="dateTime"
      >
        <Handle type="target" :position="Position.Top" />
        <CardHeader class="items-center gap-1 px-3 pt-3 pb-1">
          <div class="flex items-center gap-2">
            <Clock class="size-4 text-amber-700" aria-hidden="true" />
            <CardTitle
              class="text-[10px] font-semibold uppercase tracking-wide text-amber-700"
            >
              Date / Time
            </CardTitle>
          </div>
          <CardAction class="self-center">
            <span
              class="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-800"
              data-testid="action-badge"
            >
              {{ actionLabel }}
            </span>
          </CardAction>
        </CardHeader>
        <CardContent class="px-3 pb-3">
          <p class="truncate text-sm font-medium text-slate-900">{{ data.name }}</p>
          <p class="mt-1 line-clamp-2 text-[11px] text-slate-500">{{ summary }}</p>
        </CardContent>
        <Handle type="source" :position="Position.Bottom" />
      </Card>
    </TooltipTrigger>
    <TooltipContent side="right" :side-offset="8" class="max-w-xs">
      <div class="space-y-1">
        <p class="font-medium">{{ data.name }}</p>
        <p>Action: {{ actionLabel }}</p>
        <p>Timezone: {{ data.data.timezone }}</p>
        <ul v-if="data.data.times.length > 0" class="space-y-0.5">
          <li v-for="(row, index) in data.data.times" :key="index">
            {{ dayLabel(row.day) }} {{ row.startTime }}–{{ row.endTime }}
          </li>
        </ul>
        <p v-else class="italic opacity-70">No schedule</p>
      </div>
    </TooltipContent>
  </Tooltip>
</template>
