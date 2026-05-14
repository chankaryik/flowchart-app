import type { FlowNode } from '@/lib/types'

export const STORAGE_KEY = 'payload-v1'
export const POSITIONS_STORAGE_KEY = 'payload-positions-v1'
export const PERSIST_ENABLED_KEY = 'persist-enabled-v1'
export const PAYLOAD_URL = '/payload.json'

export type PersistedPosition = { x: number; y: number }
export type PersistedPositions = Record<string, PersistedPosition>

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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value != null && !Array.isArray(value)
}

function isPersistedPosition(value: unknown): value is PersistedPosition {
  return isRecord(value) && typeof value.x === 'number' && typeof value.y === 'number'
}

export function loadPositions(): PersistedPositions {
  if (!isPersistEnabled()) return {}
  if (typeof localStorage === 'undefined') return {}

  const raw = localStorage.getItem(POSITIONS_STORAGE_KEY)
  if (raw == null) return {}

  try {
    const parsed: unknown = JSON.parse(raw)
    if (!isRecord(parsed)) return {}

    const positions: PersistedPositions = {}
    for (const [key, value] of Object.entries(parsed)) {
      if (isPersistedPosition(value)) {
        positions[key] = { x: value.x, y: value.y }
      }
    }
    return positions
  } catch {
    return {}
  }
}

export async function saveNodes(
  nodes: FlowNode[],
  positions?: PersistedPositions,
): Promise<void> {
  if (!isPersistEnabled()) return
  if (typeof localStorage === 'undefined') return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(nodes))
  if (positions != null) {
    localStorage.setItem(POSITIONS_STORAGE_KEY, JSON.stringify(positions))
  }
}

export function enablePersistenceWithSnapshot(
  nodes: FlowNode[],
  positions: PersistedPositions,
): void {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem(PERSIST_ENABLED_KEY, '1')
  localStorage.setItem(STORAGE_KEY, JSON.stringify(nodes))
  localStorage.setItem(POSITIONS_STORAGE_KEY, JSON.stringify(positions))
}

export function clearCachedNodes(): void {
  if (typeof localStorage === 'undefined') return
  localStorage.removeItem(STORAGE_KEY)
  localStorage.removeItem(POSITIONS_STORAGE_KEY)
}

export async function resetNodes(): Promise<FlowNode[]> {
  clearCachedNodes()
  return loadNodes()
}
