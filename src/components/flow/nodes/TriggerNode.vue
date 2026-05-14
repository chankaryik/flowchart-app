<script setup lang="ts">
import { Handle, Position } from "@vue-flow/core";
import { Zap } from "lucide-vue-next";
import { computed } from "vue";

import AddNodeButton from "@/components/flow/AddNodeButton.vue";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { humanizeKey } from "@/lib/format";
import type { TriggerNode as TriggerNodeShape } from "@/lib/types";

const props = defineProps<{ id: string; data: TriggerNodeShape }>();

const eventLabel = computed(() => humanizeKey(props.data.data.type));
const oncePerContact = computed(() => props.data.data.oncePerContact);
</script>

<template>
  <Tooltip>
    <TooltipTrigger as-child>
      <Card
        class="node-card relative w-55 gap-0 border-sky-300 bg-sky-50 py-0 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 dark:border-sky-500/40 dark:bg-sky-950/40"
        data-node-type="trigger"
        :data-flow-node-id="id"
        tabindex="0"
      >
        <CardHeader class="flex flex-row items-center gap-2 px-3 pt-3 pb-2">
          <Zap class="size-4 shrink-0 text-sky-700 dark:text-sky-300" aria-hidden="true" />
          <CardTitle class="truncate text-sm font-medium text-foreground">Trigger</CardTitle>
        </CardHeader>
        <CardContent class="px-3 pb-3">
          <p class="truncate text-[11px] text-muted-foreground">{{ eventLabel }}</p>
        </CardContent>
        <Handle type="source" :position="Position.Bottom" />
        <AddNodeButton :parent-id="data.id" />
      </Card>
    </TooltipTrigger>
    <TooltipContent side="right" :side-offset="8">
      <div class="space-y-1">
        <p class="font-medium">{{ eventLabel }}</p>
        <p>
          Event key: <code class="font-mono">{{ data.data.type }}</code>
        </p>
        <p>Once per contact: {{ oncePerContact ? "yes" : "no" }}</p>
      </div>
    </TooltipContent>
  </Tooltip>
</template>
