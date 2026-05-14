import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  PAYLOAD_URL,
  PERSIST_ENABLED_KEY,
  POSITIONS_STORAGE_KEY,
  STORAGE_KEY,
  enablePersistenceWithSnapshot,
  loadNodes,
  loadPositions,
  resetNodes,
  saveNodes,
} from '@/lib/payload-adapter'
import type { FlowNode } from '@/lib/types'

const SEED: FlowNode[] = [
  { id: 1, parentId: -1, type: 'trigger', data: { type: 'conversationOpened', oncePerContact: false } },
]

function mockFetchOnce(body: FlowNode[], ok = true, status = 200) {
  const fetchMock = vi.fn<typeof fetch>().mockResolvedValue({
    ok,
    status,
    json: async () => body,
  } as Response)
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

function enablePersist(): void {
  localStorage.setItem(PERSIST_ENABLED_KEY, '1')
}

describe('payload-adapter', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  describe('loadNodes', () => {
    it('returns cached nodes when persist is enabled and cache exists', async () => {
      enablePersist()
      localStorage.setItem(STORAGE_KEY, JSON.stringify(SEED))
      const fetchMock = vi.fn<typeof fetch>()
      vi.stubGlobal('fetch', fetchMock)

      const result = await loadNodes()

      expect(result).toEqual(SEED)
      expect(fetchMock).not.toHaveBeenCalled()
    })

    it('ignores cached nodes when persist is disabled', async () => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(SEED))
      const fetchMock = mockFetchOnce(SEED)

      const result = await loadNodes()

      expect(fetchMock).toHaveBeenCalledWith(PAYLOAD_URL)
      expect(result).toEqual(SEED)
    })

    it('does not write to localStorage on fetch when persist is disabled', async () => {
      mockFetchOnce(SEED)

      await loadNodes()

      expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
    })

    it('throws when fetch responds with a non-ok status', async () => {
      mockFetchOnce([], false, 500)
      await expect(loadNodes()).rejects.toThrow(/Failed to load payload\.json/)
    })

    it('falls back to fetch when localStorage cache is invalid JSON and persist is on', async () => {
      enablePersist()
      localStorage.setItem(STORAGE_KEY, '{not json')
      const fetchMock = mockFetchOnce(SEED)

      const result = await loadNodes()

      expect(fetchMock).toHaveBeenCalled()
      expect(result).toEqual(SEED)
    })
  })

  describe('saveNodes', () => {
    it('writes the given nodes when persist is enabled', async () => {
      enablePersist()
      await saveNodes(SEED)
      expect(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]')).toEqual(SEED)
    })

    it('writes positions alongside nodes when they are provided', async () => {
      enablePersist()

      await saveNodes(SEED, { '1': { x: 10, y: 20 } })

      expect(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]')).toEqual(SEED)
      expect(JSON.parse(localStorage.getItem(POSITIONS_STORAGE_KEY) ?? '{}')).toEqual({
        '1': { x: 10, y: 20 },
      })
    })

    it('does not write when persist is disabled', async () => {
      await saveNodes(SEED, { '1': { x: 10, y: 20 } })
      expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
      expect(localStorage.getItem(POSITIONS_STORAGE_KEY)).toBeNull()
    })
  })

  describe('loadPositions', () => {
    it('returns cached positions when persist is enabled', () => {
      enablePersist()
      localStorage.setItem(POSITIONS_STORAGE_KEY, JSON.stringify({ '1': { x: 10, y: 20 } }))

      expect(loadPositions()).toEqual({ '1': { x: 10, y: 20 } })
    })

    it('ignores cached positions when persist is disabled', () => {
      localStorage.setItem(POSITIONS_STORAGE_KEY, JSON.stringify({ '1': { x: 10, y: 20 } }))

      expect(loadPositions()).toEqual({})
    })

    it('drops invalid position entries from the cache', () => {
      enablePersist()
      localStorage.setItem(
        POSITIONS_STORAGE_KEY,
        JSON.stringify({ valid: { x: 1, y: 2 }, invalid: { x: '1', y: 2 } }),
      )

      expect(loadPositions()).toEqual({ valid: { x: 1, y: 2 } })
    })
  })

  describe('enablePersistenceWithSnapshot', () => {
    it('enables persistence and writes the current nodes and positions immediately', () => {
      enablePersistenceWithSnapshot(SEED, { '1': { x: 10, y: 20 } })

      expect(localStorage.getItem(PERSIST_ENABLED_KEY)).toBe('1')
      expect(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]')).toEqual(SEED)
      expect(JSON.parse(localStorage.getItem(POSITIONS_STORAGE_KEY) ?? '{}')).toEqual({
        '1': { x: 10, y: 20 },
      })
    })
  })

  describe('resetNodes', () => {
    it('clears localStorage and re-fetches the seed payload', async () => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([{ stale: true }]))
      localStorage.setItem(POSITIONS_STORAGE_KEY, JSON.stringify({ stale: { x: 1, y: 2 } }))
      const fetchMock = mockFetchOnce(SEED)

      const result = await resetNodes()

      expect(fetchMock).toHaveBeenCalledWith(PAYLOAD_URL)
      expect(result).toEqual(SEED)
      expect(localStorage.getItem(POSITIONS_STORAGE_KEY)).toBeNull()
    })
  })
})
