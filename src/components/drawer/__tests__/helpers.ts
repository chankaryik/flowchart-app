import { mount, type ComponentMountingOptions } from '@vue/test-utils'
import { vi } from 'vitest'
import type { Component } from 'vue'
import { ref } from 'vue'

import type { UpdateNodeVars } from '@/queries/nodes'

export type MutateAsyncMock = ReturnType<
  typeof vi.fn<(vars: UpdateNodeVars) => Promise<void>>
>

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
  return mount(component, {
    ...options,
    props,
    global: {
      ...existing,
      stubs: {
        ...selectStubs,
        ...existingStubs,
      },
    },
  })
}
