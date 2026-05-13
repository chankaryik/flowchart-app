import { mount, type ComponentMountingOptions } from '@vue/test-utils'
import { createPinia } from 'pinia'
import type { Component } from 'vue'

// Vue Flow's <Handle> uses an injected VueFlow context. Outside of a real
// <VueFlow> we render a div carrying the same props so tests can assert
// handle direction and position by attribute.
export const HandleStub = {
  name: 'Handle',
  props: ['type', 'position', 'id'],
  inheritAttrs: false,
  template:
    '<span data-testid="handle" :data-handle-type="type" :data-handle-position="position" />',
}

// Shadcn/reka-ui Tooltip needs a TooltipProvider in the tree and a portal,
// neither of which adds anything testable for these specs — stub them so the
// trigger's slot renders inline and the content goes to a deterministic node.
const SlotPassthrough = { template: '<div><slot /></div>' } as Component
const SlotPassthroughAsChild = {
  inheritAttrs: false,
  template: '<slot />',
} as Component

export const tooltipStubs = {
  Tooltip: SlotPassthrough,
  TooltipTrigger: SlotPassthroughAsChild,
  TooltipContent: {
    template: '<div data-testid="tooltip-content"><slot /></div>',
  } as Component,
  TooltipProvider: SlotPassthrough,
}

export function mountNode<Props extends Record<string, unknown>>(
  component: Component,
  props: Props,
  options: ComponentMountingOptions<Component> = {},
) {
  const existing = options.global ?? {}
  const existingStubs =
    typeof existing.stubs === 'object' && existing.stubs != null ? existing.stubs : {}
  const existingPlugins = existing.plugins ?? []
  return mount(component, {
    ...options,
    props,
    global: {
      ...existing,
      plugins: [createPinia(), ...existingPlugins],
      stubs: {
        Handle: HandleStub,
        ...tooltipStubs,
        ...existingStubs,
      },
    },
  })
}
