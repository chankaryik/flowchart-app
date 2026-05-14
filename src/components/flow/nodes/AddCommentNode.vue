<script setup lang="ts">
import { Handle, Position } from "@vue-flow/core";
import { StickyNote } from "lucide-vue-next";
import { computed } from "vue";

import AddNodeButton from "@/components/flow/AddNodeButton.vue";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { AddCommentNode as AddCommentNodeShape } from "@/lib/types";
import { useFlowStore } from "@/stores/flow";

const props = defineProps<{ id: string; data: AddCommentNodeShape }>();

const store = useFlowStore();
const description = computed(() => props.data.description ?? "");
const comment = computed(() => props.data.data.comment);
const hasParent = computed(() => store.getNodeById(props.data.parentId) != null);
</script>

<template>
  <Tooltip>
    <TooltipTrigger as-child>
      <Card
        class="node-card relative w-[220px] gap-0 border-amber-300 bg-amber-50 py-0 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        data-node-type="addComment"
        :data-flow-node-id="id"
        tabindex="0"
      >
        <Handle v-if="hasParent" type="target" :position="Position.Top" />
        <CardHeader class="flex gap-2 px-3 pt-3 pb-2">
          <StickyNote class="size-4 shrink-0 text-amber-700 mt-0.5" aria-hidden="true" />
          <div class="min-w-0">
            <CardTitle class="min-w-0 flex-1 text-sm font-medium text-amber-900">
              {{ data.name }}
            </CardTitle>
            <p
              v-if="description.length > 0"
              class="truncate text-[11px] text-amber-800/80"
              data-testid="node-description"
            >
              {{ description }}
            </p>
          </div>
        </CardHeader>
        <CardContent class="px-3 pb-3">
          <p v-if="comment.length > 0" class="text-[11px] text-amber-800/80">
            {{ comment }}
          </p>
          <p v-else class="truncate text-[11px] italic text-amber-700/60">No comment yet</p>
        </CardContent>
        <Handle type="source" :position="Position.Bottom" />
        <AddNodeButton :parent-id="data.id" />
      </Card>
    </TooltipTrigger>
    <TooltipContent side="right" :side-offset="8" class="max-w-xs">
      <div class="space-y-1">
        <p class="font-medium">{{ data.name }}</p>
        <p v-if="comment.length > 0" class="whitespace-pre-line">{{ comment }}</p>
        <p v-else class="italic opacity-70">No comment yet</p>
      </div>
    </TooltipContent>
  </Tooltip>
</template>
