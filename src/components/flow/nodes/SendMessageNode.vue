<script setup lang="ts">
import { Handle, Position } from "@vue-flow/core";
import { MessageSquare, Paperclip } from "lucide-vue-next";
import { computed } from "vue";

import AddNodeButton from "@/components/flow/AddNodeButton.vue";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { attachmentCount, firstTextPreview } from "@/lib/format";
import type { SendMessageNode as SendMessageNodeShape } from "@/lib/types";
import { useFlowStore } from "@/stores/flow";

const props = defineProps<{ id: string; data: SendMessageNodeShape }>();

const store = useFlowStore();
const description = computed(() => props.data.description ?? "");
const preview = computed(() => firstTextPreview(props.data.data.payload));
const attachments = computed(() => attachmentCount(props.data.data.payload));
const hasParent = computed(() => store.getNodeById(props.data.parentId) != null);
</script>

<template>
  <Tooltip>
    <TooltipTrigger as-child>
      <Card
        class="node-card relative w-55 gap-0 border-violet-300 bg-violet-50 py-0 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 dark:border-violet-500/40 dark:bg-violet-950/40"
        data-node-type="sendMessage"
        :data-flow-node-id="id"
        tabindex="0"
      >
        <Handle v-if="hasParent" type="target" :position="Position.Top" />
        <CardHeader class="flex justify-between gap-2 px-3 pt-3 pb-2">
          <div class="flex gap-2 min-w-0">
            <MessageSquare
              class="size-4 shrink-0 text-violet-700 mt-0.5 dark:text-violet-300"
              aria-hidden="true"
            />
            <div class="min-w-0">
              <CardTitle class="min-w-0 flex-1 text-sm font-medium text-card-foreground">
                {{ data.name }}
              </CardTitle>
              <p
                v-if="description.length > 0"
                class="truncate text-[11px] text-muted-foreground"
                data-testid="node-description"
              >
                {{ description }}
              </p>
            </div>
          </div>
          <CardAction v-if="attachments > 0">
            <span
              class="inline-flex items-center gap-0.5 rounded-full bg-violet-100 px-1.5 py-0.5 text-[10px] font-medium text-violet-700 dark:bg-violet-500/20 dark:text-violet-200"
              :aria-label="`${attachments} attachment${attachments === 1 ? '' : 's'}`"
              data-testid="attachment-count"
            >
              <Paperclip class="size-3" aria-hidden="true" />
              {{ attachments }}
            </span>
          </CardAction>
        </CardHeader>
        <CardContent class="px-3 pb-3">
          <p v-if="preview.length > 0" class="text-[11px] text-muted-foreground">
            {{ preview }}
          </p>
          <p v-else class="truncate text-[11px] italic text-muted-foreground/70">No message yet</p>
        </CardContent>
        <Handle type="source" :position="Position.Bottom" />
        <AddNodeButton :parent-id="data.id" />
      </Card>
    </TooltipTrigger>
    <TooltipContent side="right" :side-offset="8" class="max-w-xs">
      <div class="space-y-1">
        <p class="font-medium">{{ data.name }}</p>
        <p v-if="preview.length > 0" class="whitespace-pre-line">{{ preview }}</p>
        <p v-else class="italic opacity-70">No message yet</p>
        <p v-if="attachments > 0">{{ attachments }} attachment{{ attachments === 1 ? "" : "s" }}</p>
      </div>
    </TooltipContent>
  </Tooltip>
</template>
