import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

import ThemeToggle from '@/components/ThemeToggle.vue'
import { __resetThemeForTests } from '@/composables/useTheme'

function installMatchMedia(initialDark: boolean): void {
  const mql = {
    matches: initialDark,
    media: '(prefers-color-scheme: dark)',
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => true,
  }
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: vi.fn<(query: string) => MediaQueryList>().mockReturnValue(mql as MediaQueryList),
  })
}

const dropdownStubs = {
  DropdownMenu: { template: '<div><slot /></div>' },
  DropdownMenuTrigger: { props: ['asChild'], template: '<div><slot /></div>' },
  DropdownMenuContent: {
    props: ['align'],
    template: '<div data-testid="dropdown-content" :data-align="align"><slot /></div>',
  },
  DropdownMenuItem: {
    emits: ['select'],
    template:
      '<button type="button" :data-testid="$attrs[\'data-testid\']" :data-active="$attrs[\'data-active\']" @click="$emit(\'select\')"><slot /></button>',
  },
}

describe('ThemeToggle', () => {
  beforeEach(() => {
    installMatchMedia(false)
    document.documentElement.classList.remove('dark')
    localStorage.clear()
    __resetThemeForTests()
  })

  afterEach(() => {
    document.documentElement.classList.remove('dark')
    localStorage.clear()
    __resetThemeForTests()
  })

  it('renders the icon variant by default', () => {
    const wrapper = mount(ThemeToggle, { global: { stubs: dropdownStubs } })
    expect(wrapper.find('[data-testid="theme-toggle"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="theme-toggle-row"]').exists()).toBe(false)
  })

  it('renders the row variant when variant="row"', () => {
    const wrapper = mount(ThemeToggle, {
      props: { variant: 'row' },
      global: { stubs: dropdownStubs },
    })
    expect(wrapper.find('[data-testid="theme-toggle-row"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="theme-toggle"]').exists()).toBe(false)
  })

  it('exposes all three theme options', () => {
    const wrapper = mount(ThemeToggle, { global: { stubs: dropdownStubs } })
    expect(wrapper.find('[data-testid="theme-option-light"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="theme-option-dark"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="theme-option-auto"]').exists()).toBe(true)
  })

  it('marks the active option with data-active=true', async () => {
    const wrapper = mount(ThemeToggle, { global: { stubs: dropdownStubs } })
    expect(wrapper.find('[data-testid="theme-option-auto"]').attributes('data-active')).toBe('true')

    await wrapper.find('[data-testid="theme-option-dark"]').trigger('click')
    await nextTick()
    expect(wrapper.find('[data-testid="theme-option-dark"]').attributes('data-active')).toBe('true')
    expect(
      wrapper.find('[data-testid="theme-option-auto"]').attributes('data-active'),
    ).toBeUndefined()
  })

  it('toggles the .dark class on the html element when the user picks dark', async () => {
    const wrapper = mount(ThemeToggle, { global: { stubs: dropdownStubs } })
    await wrapper.find('[data-testid="theme-option-dark"]').trigger('click')
    await nextTick()
    expect(document.documentElement.classList.contains('dark')).toBe(true)

    await wrapper.find('[data-testid="theme-option-light"]').trigger('click')
    await nextTick()
    expect(document.documentElement.classList.contains('dark')).toBe(false)
  })
})
