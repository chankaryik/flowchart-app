<script setup lang="ts">
import { Handle, Position } from "@vue-flow/core";
import { Zap } from "lucide-vue-next";
import { computed } from "vue";

import AddNodeButton from "@/components/flow/AddNodeButton.vue";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { humanizeKey } from "@/lib/format";
import type { TriggerNode as TriggerNodeShape } from "@/lib/types";

// Vue Flow's node slot passes the FlowNode itself via the `data` prop on the
// custom-node template (see FlowCanvas.vue), so `data.data.type` is the
// trigger's underlying event key (e.g. "conversationOpened").
const props = defineProps<{ id: string; data: TriggerNodeShape }>();

const eventLabel = computed(() => humanizeKey(props.data.data.type));
const oncePerContact = computed(() => props.data.data.oncePerContact);
</script>

<template>
  <Tooltip>
    <TooltipTrigger as-child>
      <!-- Trigger is locked per Day-0 decision (TODO.md): exactly one trigger per
           flow, not deletable, never offered in Create New Node. -->
      <Card
        class="node-card relative w-[220px] gap-0 border-sky-300 bg-sky-50 py-0 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        data-node-type="trigger"
        :data-flow-node-id="id"
        tabindex="0"
      >
        <CardHeader class="flex-row items-center gap-2 px-3 pt-3 pb-1">
          <Zap class="size-4 text-sky-700" aria-hidden="true" />
          <CardTitle class="text-[10px] font-semibold uppercase tracking-wide text-sky-700">
            Trigger
          </CardTitle>
        </CardHeader>
        <CardContent class="px-3 pb-3">
          <p class="truncate text-sm font-medium text-slate-900">{{ eventLabel }}</p>
          <p class="mt-1 text-[11px] text-slate-500">
            {{ oncePerContact ? "Once per contact" : "Every time" }}
          </p>
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
