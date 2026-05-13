import { ref, watch, type Ref } from 'vue'

export const PERSIST_ENABLED_KEY = 'persist-enabled-v1'

function read(): boolean {
  if (typeof localStorage === 'undefined') return false
  return localStorage.getItem(PERSIST_ENABLED_KEY) === '1'
}

export function usePersistFlag(): Ref<boolean> {
  const state = ref(read())
  watch(state, (next) => {
    if (typeof localStorage === 'undefined') return
    if (next) localStorage.setItem(PERSIST_ENABLED_KEY, '1')
    else localStorage.removeItem(PERSIST_ENABLED_KEY)
  })
  return state
}
