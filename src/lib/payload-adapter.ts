import type { FlowNode } from '@/lib/types'

export const STORAGE_KEY = 'payload-v1'
export const PAYLOAD_URL = '/payload.json'

export async function loadNodes(): Promise<FlowNode[]> {
  const cached = readFromStorage()
  if (cached != null) {
    return cached
  }

  const response = await fetch(PAYLOAD_URL)
  if (!response.ok) {
    throw new Error(`Failed to load payload.json (status ${response.status}).`)
  }
  const parsed = (await response.json()) as FlowNode[]
  writeToStorage(parsed)
  return parsed
}

export async function saveNodes(nodes: FlowNode[]): Promise<void> {
  writeToStorage(nodes)
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
