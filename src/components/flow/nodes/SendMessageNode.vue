<script setup lang="ts">
import { Handle, Position } from '@vue-flow/core'
import { MessageSquare, Paperclip } from 'lucide-vue-next'
import { computed } from 'vue'

import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { attachmentCount, firstTextPreview } from '@/lib/format'
import type { SendMessageNode as SendMessageNodeShape } from '@/lib/types'

const props = defineProps<{ id: string; data: SendMessageNodeShape }>()

const preview = computed(() => firstTextPreview(props.data.data.payload))
const attachments = computed(() => attachmentCount(props.data.data.payload))
</script>

<template>
  <Tooltip>
    <TooltipTrigger as-child>
      <Card
        class="node-card w-[220px] gap-0 border-violet-300 bg-white py-0 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        data-node-type="sendMessage"
        :data-flow-node-id="id"
        tabindex="0"
      >
        <Handle type="target" :position="Position.Top" />
        <CardHeader class="items-center gap-1 px-3 pt-3 pb-1">
          <div class="flex items-center gap-2">
            <MessageSquare class="size-4 text-violet-700" aria-hidden="true" />
            <CardTitle
              class="text-[10px] font-semibold uppercase tracking-wide text-violet-700"
            >
              Send Message
            </CardTitle>
          </div>
          <CardAction v-if="attachments > 0" class="self-center">
            <span
              class="inline-flex items-center gap-0.5 rounded-full bg-violet-100 px-1.5 py-0.5 text-[10px] font-medium text-violet-700"
              :aria-label="`${attachments} attachment${attachments === 1 ? '' : 's'}`"
              data-testid="attachment-count"
            >
              <Paperclip class="size-3" aria-hidden="true" />
              {{ attachments }}
            </span>
          </CardAction>
        </CardHeader>
        <CardContent class="px-3 pb-3">
          <p class="truncate text-sm font-medium text-slate-900">{{ data.name }}</p>
          <p
            v-if="preview.length > 0"
            class="mt-1 line-clamp-2 text-[11px] text-slate-500"
          >
            {{ preview }}
          </p>
          <p v-else class="mt-1 text-[11px] italic text-slate-400">No message yet</p>
        </CardContent>
        <Handle type="source" :position="Position.Bottom" />
      </Card>
    </TooltipTrigger>
    <TooltipContent side="right" :side-offset="8" class="max-w-xs">
      <div class="space-y-1">
        <p class="font-medium">{{ data.name }}</p>
        <p v-if="preview.length > 0" class="whitespace-pre-line">{{ preview }}</p>
        <p v-else class="italic opacity-70">No message yet</p>
        <p v-if="attachments > 0">
          {{ attachments }} attachment{{ attachments === 1 ? '' : 's' }}
        </p>
      </div>
    </TooltipContent>
  </Tooltip>
</template>
