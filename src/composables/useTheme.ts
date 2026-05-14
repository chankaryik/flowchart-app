import { useMediaQuery, useStorage } from '@vueuse/core'
import { computed, effectScope, watchEffect, type ComputedRef, type Ref } from 'vue'

export const THEME_STORAGE_KEY = 'theme-mode-v1'

export type ThemeChoice = 'light' | 'dark' | 'auto'
export type ResolvedTheme = 'light' | 'dark'

type UseThemeReturn = {
  /** The user's saved preference: 'light' | 'dark' | 'auto'. Writable. */
  mode: Ref<ThemeChoice>
  /** The actually-applied theme after resolving 'auto' against the OS. */
  resolved: ComputedRef<ResolvedTheme>
}

let cached: UseThemeReturn | null = null
let cachedScope: ReturnType<typeof effectScope> | null = null

/**
 * Test-only: drop the cached singleton so the next useTheme() call starts
 * fresh. Production code never needs this — the singleton lives for the page.
 */
export function __resetThemeForTests(): void {
  cachedScope?.stop()
  cachedScope = null
  cached = null
}

// Single source of truth for theme: persists `mode` to localStorage, watches
// the OS preference for 'auto', and toggles `.dark` on <html>. Runs inside a
// detached effect scope so the storage subscription and media-query listener
// outlive any individual component. The inline script in index.html applies
// the saved value before Vue mounts so there's no flash on first paint.
export function useTheme(): UseThemeReturn {
  if (cached != null) return cached

  cachedScope = effectScope(true)
  cached = cachedScope.run(() => {
    const mode = useStorage<ThemeChoice>(THEME_STORAGE_KEY, 'auto')
    const prefersDark = useMediaQuery('(prefers-color-scheme: dark)')

    const resolved = computed<ResolvedTheme>(() => {
      if (mode.value === 'dark') return 'dark'
      if (mode.value === 'light') return 'light'
      return prefersDark.value ? 'dark' : 'light'
    })

    if (typeof document !== 'undefined') {
      watchEffect(() => {
        document.documentElement.classList.toggle('dark', resolved.value === 'dark')
      })
    }

    return { mode, resolved }
  }) as UseThemeReturn

  return cached
}
