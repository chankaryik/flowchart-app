import { onBeforeUnmount, onMounted } from 'vue'

// Capture phase so the handler reaches us before reka-ui portals (Sheet,
// AlertDialog) that can stopPropagation in their focus traps.
export function useGlobalKeydown(handler: (event: KeyboardEvent) => void): void {
  onMounted(() => {
    window.addEventListener('keydown', handler, true)
  })
  onBeforeUnmount(() => {
    window.removeEventListener('keydown', handler, true)
  })
}
