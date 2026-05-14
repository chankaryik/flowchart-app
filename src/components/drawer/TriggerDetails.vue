<script setup lang="ts">
import { Lock } from "lucide-vue-next";
import { computed } from "vue";

import { Label } from "@/components/ui/label";
import { humanizeKey } from "@/lib/format";
import type { TriggerNode } from "@/lib/types";

// Read-only by design (Day-0 lock confirmed Phase 6): exactly one trigger per
// flow, never deletable, never offered in Create New Node. Its config is shown
// here for context only.
const props = defineProps<{ node: TriggerNode }>();

const eventLabel = computed(() => humanizeKey(props.node.data.type));
const oncePerContact = computed(() => props.node.data.oncePerContact);
</script>

<template>
  <section class="flex h-full flex-col" data-testid="trigger-details">
    <div class="flex-1 space-y-4 overflow-y-auto px-4 py-4">
      <div
        class="flex items-center gap-2 rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-800"
      >
        <Lock class="size-3.5" />
        <span>Trigger is locked. It's the entry point of the flow and not editable.</span>
      </div>

      <div class="space-y-1.5">
        <Label>Event</Label>
        <div
          class="flex h-9 items-center rounded-md border border-input bg-muted px-3 text-sm text-foreground"
        >
          {{ eventLabel }}
        </div>
      </div>

      <div class="space-y-1.5">
        <Label>Event key</Label>
        <div
          class="flex h-9 items-center rounded-md border border-input bg-muted px-3 font-mono text-xs text-muted-foreground"
        >
          {{ props.node.data.type }}
        </div>
      </div>

      <div class="space-y-1.5">
        <Label>Once per contact</Label>
        <div
          class="flex h-9 items-center rounded-md border border-input bg-muted px-3 text-sm text-muted-foreground"
        >
          {{ oncePerContact ? "Yes" : "No" }}
        </div>
      </div>
    </div>
  </section>
</template>
