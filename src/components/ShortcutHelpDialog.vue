<script setup lang="ts">
import { computed } from 'vue'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ 'update:open': [value: boolean] }>()

function isMac(): boolean {
  if (typeof navigator === 'undefined') return false
  const platform = navigator.platform ?? ''
  if (platform !== '') return /Mac|iPod|iPhone|iPad/.test(platform)
  return /Mac|iPod|iPhone|iPad/.test(navigator.userAgent ?? '')
}

const mod = computed(() => (isMac() ? 'Cmd' : 'Ctrl'))

type Shortcut = { keys: string[]; description: string }

const navigationShortcuts = computed<Shortcut[]>(() => [
  { keys: ['Tab'], description: 'Focus next node' },
  { keys: ['Shift', 'Tab'], description: 'Focus previous node' },
  { keys: ['Up', 'Down', 'Left', 'Right'], description: 'Move focus through nodes' },
  { keys: ['Enter'], description: 'Open details for the focused node' },
  { keys: ['Esc'], description: 'Close the open drawer or dialog' },
])

const editingShortcuts = computed<Shortcut[]>(() => [
  { keys: [mod.value, 'Z'], description: 'Undo last change' },
  { keys: [mod.value, 'Shift', 'Z'], description: 'Redo last undone change' },
  ...(isMac() ? [] : [{ keys: ['Ctrl', 'Y'], description: 'Redo (Windows alias)' }]),
])

const helpShortcuts: Shortcut[] = [{ keys: ['?'], description: 'Show this help' }]

function onUpdateOpen(value: boolean): void {
  emit('update:open', value)
}
</script>

<template>
  <Dialog :open="props.open" @update:open="onUpdateOpen">
    <DialogContent class="sm:max-w-md" data-testid="shortcut-help">
      <DialogHeader>
        <DialogTitle>Keyboard shortcuts</DialogTitle>
        <DialogDescription>
          Every part of the flow chart can be driven from the keyboard.
        </DialogDescription>
      </DialogHeader>
      <section class="space-y-4 text-sm">
        <div>
          <h3 class="mb-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Navigation
          </h3>
          <ul class="space-y-1.5">
            <li
              v-for="shortcut in navigationShortcuts"
              :key="shortcut.description"
              class="flex items-center justify-between gap-3"
            >
              <span>{{ shortcut.description }}</span>
              <span class="flex items-center gap-1">
                <template v-for="(k, i) in shortcut.keys" :key="i">
                  <kbd
                    class="inline-flex h-5 min-w-5 items-center justify-center rounded border border-border bg-muted px-1.5 font-mono text-[11px] font-medium text-muted-foreground"
                  >
                    {{ k }}
                  </kbd>
                  <span v-if="i < shortcut.keys.length - 1" class="text-xs text-muted-foreground"
                    >+</span
                  >
                </template>
              </span>
            </li>
          </ul>
        </div>
        <div>
          <h3 class="mb-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Editing
          </h3>
          <ul class="space-y-1.5">
            <li
              v-for="shortcut in editingShortcuts"
              :key="shortcut.description"
              class="flex items-center justify-between gap-3"
            >
              <span>{{ shortcut.description }}</span>
              <span class="flex items-center gap-1">
                <template v-for="(k, i) in shortcut.keys" :key="i">
                  <kbd
                    class="inline-flex h-5 min-w-5 items-center justify-center rounded border border-border bg-muted px-1.5 font-mono text-[11px] font-medium text-muted-foreground"
                  >
                    {{ k }}
                  </kbd>
                  <span v-if="i < shortcut.keys.length - 1" class="text-xs text-muted-foreground"
                    >+</span
                  >
                </template>
              </span>
            </li>
          </ul>
        </div>
        <div>
          <h3 class="mb-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Help
          </h3>
          <ul class="space-y-1.5">
            <li
              v-for="shortcut in helpShortcuts"
              :key="shortcut.description"
              class="flex items-center justify-between gap-3"
            >
              <span>{{ shortcut.description }}</span>
              <kbd
                class="inline-flex h-5 min-w-5 items-center justify-center rounded border border-border bg-muted px-1.5 font-mono text-[11px] font-medium text-muted-foreground"
              >
                {{ shortcut.keys[0] }}
              </kbd>
            </li>
          </ul>
        </div>
      </section>
    </DialogContent>
  </Dialog>
</template>
