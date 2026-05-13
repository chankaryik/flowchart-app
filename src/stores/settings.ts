import { defineStore } from 'pinia'
import { ref } from 'vue'

export const PERSIST_ENABLED_KEY = 'persist-enabled-v1'

function readInitial(): boolean {
  if (typeof localStorage === 'undefined') return false
  return localStorage.getItem(PERSIST_ENABLED_KEY) === '1'
}

export const useSettingsStore = defineStore('settings', () => {
  const persistEnabled = ref<boolean>(readInitial())

  function setPersistEnabled(next: boolean): void {
    persistEnabled.value = next
    if (typeof localStorage === 'undefined') return
    if (next) {
      localStorage.setItem(PERSIST_ENABLED_KEY, '1')
    } else {
      localStorage.removeItem(PERSIST_ENABLED_KEY)
    }
  }

  return { persistEnabled, setPersistEnabled }
})
