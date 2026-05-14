import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

import { __resetThemeForTests, THEME_STORAGE_KEY, useTheme } from '@/composables/useTheme'

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

describe('useTheme', () => {
  beforeEach(() => {
    document.documentElement.classList.remove('dark')
    localStorage.clear()
    __resetThemeForTests()
  })

  afterEach(() => {
    document.documentElement.classList.remove('dark')
    localStorage.clear()
    __resetThemeForTests()
  })

  it('defaults to "auto" and follows the OS preference when no choice is saved', async () => {
    installMatchMedia(true)
    const { mode, resolved } = useTheme()
    expect(mode.value).toBe('auto')
    expect(resolved.value).toBe('dark')
    await nextTick()
    expect(document.documentElement.classList.contains('dark')).toBe(true)
  })

  it('honors a saved "light" choice over the OS preference', async () => {
    installMatchMedia(true)
    localStorage.setItem(THEME_STORAGE_KEY, 'light')
    const { mode, resolved } = useTheme()
    expect(mode.value).toBe('light')
    expect(resolved.value).toBe('light')
    await nextTick()
    expect(document.documentElement.classList.contains('dark')).toBe(false)
  })

  it('updates the .dark class when the user switches modes', async () => {
    installMatchMedia(false)
    const { mode, resolved } = useTheme()
    expect(resolved.value).toBe('light')

    mode.value = 'dark'
    await nextTick()
    expect(resolved.value).toBe('dark')
    expect(document.documentElement.classList.contains('dark')).toBe(true)

    mode.value = 'light'
    await nextTick()
    expect(document.documentElement.classList.contains('dark')).toBe(false)
  })

  it('persists the choice to localStorage under THEME_STORAGE_KEY', async () => {
    installMatchMedia(false)
    const { mode } = useTheme()
    mode.value = 'dark'
    await nextTick()
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark')
  })

  it('returns the same singleton across calls within a session', () => {
    installMatchMedia(false)
    const a = useTheme()
    const b = useTheme()
    expect(a.mode).toBe(b.mode)
    expect(a.resolved).toBe(b.resolved)
  })
})
