import type { FlowNode } from '@/lib/types'
import { PERSIST_ENABLED_KEY } from '@/stores/settings'

export const STORAGE_KEY = 'payload-v1'
export const PAYLOAD_URL = '/payload.json'

export function isPersistEnabled(): boolean {
  if (typeof localStorage === 'undefined') return false
  return localStorage.getItem(PERSIST_ENABLED_KEY) === '1'
}

export async function loadNodes(): Promise<FlowNode[]> {
  // Cache is only honoured when persistence is enabled. With persistence off
  // we always re-fetch the canonical seed so a refresh resets the canvas.
  if (isPersistEnabled()) {
    const cached = readFromStorage()
    if (cached != null) {
      return cached
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
  writeToStorage(nodes)
}

export function clearCachedNodes(): void {
  clearStorage()
}

export async function resetNodes(): Promise<FlowNode[]> {
  clearStorage()
  return loadNodes()
}

function readFromStorage(): FlowNode[] | null {
  if (typeof localStorage === 'undefined') {
    return null
  }
  const raw = localStorage.getItem(STORAGE_KEY)
  if (raw == null) {
    return null
  }
  try {
    return JSON.parse(raw) as FlowNode[]
  } catch {
    return null
  }
}

function writeToStorage(nodes: FlowNode[]): void {
  if (typeof localStorage === 'undefined') {
    return
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(nodes))
}

function clearStorage(): void {
  if (typeof localStorage === 'undefined') {
    return
  }
  localStorage.removeItem(STORAGE_KEY)
}
