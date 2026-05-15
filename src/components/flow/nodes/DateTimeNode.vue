<script setup lang="ts">
import { Handle, Position } from '@vue-flow/core'
import { Clock } from 'lucide-vue-next'
import { computed } from 'vue'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { dayLabel, summarizeBusinessHours } from '@/lib/format'
import type { DateTimeNode as DateTimeNodeShape } from '@/lib/types'
import { useFlowStore } from '@/stores/flow'

const props = defineProps<{ id: string; data: DateTimeNodeShape }>()

const store = useFlowStore()
const description = computed(() => props.data.description ?? '')
const summary = computed(() =>
  summarizeBusinessHours(props.data.data.times, props.data.data.timezone),
)
const openRows = computed(() => props.data.data.times.filter((row) => row.closed !== true))
const hasParent = computed(() => store.getNodeById(props.data.parentId) != null)
</script>

<template>
  <Tooltip>
    <TooltipTrigger as-child>
      <Card
        class="node-card w-55 gap-0 border-lime-300 bg-lime-50 py-0 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 dark:border-lime-500/40 dark:bg-lime-950/40"
        data-node-type="dateTime"
        :data-flow-node-id="id"
        tabindex="0"
      >
        <Handle v-if="hasParent" type="target" :position="Position.Top" />
        <CardHeader class="flex gap-2 px-3 pt-3 pb-2">
          <Clock
            class="size-4 shrink-0 text-lime-700 mt-0.5 dark:text-lime-300"
            aria-hidden="true"
          />
          <div class="min-w-0">
            <CardTitle class="text-sm font-medium text-card-foreground">
              {{ data.name }}
            </CardTitle>
            <p
              v-if="description.length > 0"
              class="truncate text-2xs text-muted-foreground"
              data-testid="node-description"
            >
              {{ description }}
            </p>
          </div>
        </CardHeader>
        <CardContent class="px-3 pb-3">
          <p class="truncate text-2xs text-muted-foreground">{{ summary }}</p>
        </CardContent>
        <Handle type="source" :position="Position.Bottom" />
      </Card>
    </TooltipTrigger>
    <TooltipContent side="right" :side-offset="8" class="max-w-xs">
      <div class="space-y-1">
        <p class="font-medium">{{ data.name }}</p>
        <p>Timezone: {{ data.data.timezone }}</p>
        <ul v-if="openRows.length > 0" class="space-y-0.5">
          <li v-for="(row, index) in openRows" :key="index">
            {{ dayLabel(row.day) }} {{ row.startTime }}–{{ row.endTime }}
          </li>
        </ul>
        <p v-else class="italic opacity-70">Closed all week</p>
      </div>
    </TooltipContent>
  </Tooltip>
</template>
