import { flushPromises, mount, type ComponentMountingOptions } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { vi } from 'vitest'
import type { Component } from 'vue'
import { ref } from 'vue'

import type { UpdateNodeVars } from '@/queries/nodes'

// Vee-validate's validation pipeline schedules onto the macrotask queue, so
// microtask-only flushers (flushPromises, $nextTick) miss it. A zero-delay
// setTimeout drains the macrotask queue; then flushPromises picks up any
// follow-up microtasks (error state propagation, computed recompute).
export async function flushValidation(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 20))
  await flushPromises()
}

export type MutateAsyncMock = ReturnType<typeof vi.fn<(vars: UpdateNodeVars) => Promise<void>>>

export function makeUpdateNodeMock(): {
  mutateAsync: MutateAsyncMock
  isPending: ReturnType<typeof ref<boolean>>
} {
  return {
    mutateAsync: vi.fn<(vars: UpdateNodeVars) => Promise<void>>().mockResolvedValue(undefined),
    isPending: ref(false),
  }
}

// shadcn Select uses reka-ui's SelectRoot which needs portal/teleport that
// is awkward to drive in jsdom. Stub it to a native <select> bound to
// modelValue so tests can change it via setValue('PST').
export const selectStubs = {
  Select: {
    name: 'Select',
    props: ['modelValue'],
    emits: ['update:modelValue'],
    template:
      '<select :value="modelValue" @change="$emit(\'update:modelValue\', $event.target.value)"><slot /></select>',
  } as Component,
  SelectTrigger: { template: '<span><slot /></span>' } as Component,
  SelectValue: { template: '<span><slot /></span>' } as Component,
  SelectContent: { template: '<template><slot /></template>' } as Component,
  SelectItem: {
    name: 'SelectItem',
    props: ['value'],
    template: '<option :value="value"><slot /></option>',
  } as Component,
}

export function mountEditor<P extends Record<string, unknown>>(
  component: Component,
  props: P,
  options: ComponentMountingOptions<Component> = {},
) {
  const existing = options.global ?? {}
  const existingStubs =
    typeof existing.stubs === 'object' && existing.stubs != null ? existing.stubs : {}
  const existingPlugins = Array.isArray(existing.plugins) ? existing.plugins : []
  return mount(component, {
    ...options,
    props,
    global: {
      ...existing,
      plugins: [createPinia(), ...existingPlugins],
      stubs: {
        ...selectStubs,
        ...existingStubs,
      },
    },
  })
}
