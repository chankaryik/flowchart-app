<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { humanizeKey } from '@/lib/format'
import type { FlowNode } from '@/lib/types'
import { useFlowStore } from '@/stores/flow'

import AddCommentEditor from './AddCommentEditor.vue'
import BusinessHoursEditor from './BusinessHoursEditor.vue'
import SendMessageEditor from './SendMessageEditor.vue'
import TriggerDetails from './TriggerDetails.vue'

const route = useRoute()
const router = useRouter()
const store = useFlowStore()

const drawerId = computed(() => {
  const raw = route.params.id
  if (raw == null) return null
  const value = Array.isArray(raw) ? raw[0] : raw
  return value == null || value === '' ? null : value
})

const node = computed<FlowNode | null>(() => {
  const id = drawerId.value
  if (id == null) return null
  const found = store.getNodeById(id)
  if (found == null || found.type === 'dateTimeConnector') return null
  return found
})

const isOpen = computed(() => node.value != null)

function onUpdateOpen(open: boolean): void {
  if (!open) close()
}

function close(): void {
  void router.push('/')
}

function nodeTitle(n: FlowNode): string {
  return 'name' in n ? n.name : `Trigger #${n.id}`
}

function typeLabel(n: FlowNode): string {
  switch (n.type) {
    case 'trigger':
      return 'Trigger'
    case 'sendMessage':
      return 'Send Message'
    case 'dateTime':
      return 'Date / Time'
    case 'addComment':
      return 'Comment'
    case 'dateTimeConnector':
      return 'Connector'
    default:
      return humanizeKey((n as { type: string }).type)
  }
}
</script>

<template>
  <Sheet :open="isOpen" @update:open="onUpdateOpen">
    <!-- Sheet slides via CSS translateX per CLAUDE.md §8.6 — no width animations. -->
    <SheetContent
      side="right"
      class="flex w-full flex-col gap-0 p-0 sm:max-w-md"
      data-testid="node-details-drawer"
    >
      <template v-if="node">
        <SheetHeader class="border-b border-border px-4 py-3">
          <span
            class="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground"
          >
            {{ typeLabel(node) }}
          </span>
          <SheetTitle class="text-base font-semibold">{{ nodeTitle(node) }}</SheetTitle>
          <SheetDescription class="text-xs">
            ID <code class="font-mono">{{ node.id }}</code>
          </SheetDescription>
        </SheetHeader>

        <div class="min-h-0 flex-1">
          <SendMessageEditor
            v-if="node.type === 'sendMessage'"
            :node="node"
            @saved="close"
          />
          <BusinessHoursEditor
            v-else-if="node.type === 'dateTime'"
            :node="node"
            @saved="close"
          />
          <AddCommentEditor
            v-else-if="node.type === 'addComment'"
            :node="node"
            @saved="close"
          />
          <TriggerDetails v-else-if="node.type === 'trigger'" :node="node" />
        </div>
      </template>
    </SheetContent>
  </Sheet>
</template>
