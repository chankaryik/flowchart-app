<script setup lang="ts">
import { ChevronDown, Monitor, Moon, Sun } from 'lucide-vue-next'
import { computed } from 'vue'

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useTheme } from '@/composables/useTheme'

type Choice = 'light' | 'dark' | 'auto'

const props = withDefaults(
  defineProps<{
    variant?: 'icon' | 'row'
    align?: 'start' | 'center' | 'end'
  }>(),
  { variant: 'icon', align: 'end' },
)

const { mode } = useTheme()

const options: { value: Choice; label: string; icon: typeof Sun }[] = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'auto', label: 'System', icon: Monitor },
]

const current = computed<Choice>(() => mode.value)

const currentLabel = computed(
  () => options.find((opt) => opt.value === current.value)?.label ?? 'System',
)

const isIcon = computed(() => props.variant === 'icon')
</script>

<template>
  <DropdownMenu>
    <DropdownMenuTrigger as-child>
      <button
        v-if="isIcon"
        type="button"
        class="relative inline-flex items-center justify-center rounded-md border border-input bg-background px-2 py-1.5 text-xs font-medium text-foreground shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        aria-label="Toggle theme"
        :title="`Theme: ${currentLabel}`"
        data-testid="theme-toggle"
      >
        <Sun
          class="size-3 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0"
          aria-hidden="true"
        />
        <Moon
          class="absolute size-3 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100"
          aria-hidden="true"
        />
        <span class="sr-only">Theme: {{ currentLabel }}</span>
      </button>

      <button
        v-else
        type="button"
        class="inline-flex w-full items-center justify-between gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm font-medium text-foreground shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        data-testid="theme-toggle-row"
      >
        <span class="inline-flex items-center gap-2">
          <Sun v-if="current === 'light'" class="size-4" aria-hidden="true" />
          <Moon v-else-if="current === 'dark'" class="size-4" aria-hidden="true" />
          <Monitor v-else class="size-4" aria-hidden="true" />
          Theme: {{ currentLabel }}
        </span>
        <ChevronDown class="size-4 opacity-60" aria-hidden="true" />
      </button>
    </DropdownMenuTrigger>
    <DropdownMenuContent :align="align" class="min-w-36">
      <DropdownMenuItem
        v-for="opt in options"
        :key="opt.value"
        :data-testid="`theme-option-${opt.value}`"
        :data-active="current === opt.value ? 'true' : undefined"
        :class="current === opt.value ? 'bg-accent text-accent-foreground' : ''"
        @select="mode = opt.value"
      >
        <component :is="opt.icon" class="size-4" aria-hidden="true" />
        {{ opt.label }}
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
</template>
