import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { PAYLOAD_URL, STORAGE_KEY, loadNodes, resetNodes, saveNodes } from '@/lib/payload-adapter'
import type { FlowNode } from '@/lib/types'
import { PERSIST_ENABLED_KEY } from '@/stores/settings'

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

    it('does not write when persist is disabled', async () => {
      await saveNodes(SEED)
      expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
    })
  })

  describe('resetNodes', () => {
    it('clears localStorage and re-fetches the seed payload', async () => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([{ stale: true }]))
      const fetchMock = mockFetchOnce(SEED)

      const result = await resetNodes()

      expect(fetchMock).toHaveBeenCalledWith(PAYLOAD_URL)
      expect(result).toEqual(SEED)
    })
  })
})
