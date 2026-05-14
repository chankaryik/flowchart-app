import type { FlowNode } from '@/lib/types'

export const STORAGE_KEY = 'payload-v1'
export const PERSIST_ENABLED_KEY = 'persist-enabled-v1'
export const PAYLOAD_URL = '/payload.json'

export function isPersistEnabled(): boolean {
  if (typeof localStorage === 'undefined') return false
  return localStorage.getItem(PERSIST_ENABLED_KEY) === '1'
}

export async function loadNodes(): Promise<FlowNode[]> {
  // Cache is only honoured when persistence is enabled. With persistence off
  // we always re-fetch the canonical seed so a refresh resets the canvas.
  if (isPersistEnabled() && typeof localStorage !== 'undefined') {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw != null) {
      try {
        return JSON.parse(raw) as FlowNode[]
      } catch {
        // fall through to fetch on parse failure
      }
    }
  }

  const response = await fetch(PAYLOAD_URL)
  if (!response.ok) {
    throw new Error(`Failed to load payload.json (status ${response.status}).`)
  }
  return (await response.json()) as FlowNode[]
}

export async function saveNodes(nodes: FlowNode[]): Promise<void> {
  if (!isPersistEnabled()) return
  if (typeof localStorage === 'undefined') return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(nodes))
}

export function clearCachedNodes(): void {
  if (typeof localStorage === 'undefined') return
  localStorage.removeItem(STORAGE_KEY)
}

export async function resetNodes(): Promise<FlowNode[]> {
  clearCachedNodes()
  return loadNodes()
}
