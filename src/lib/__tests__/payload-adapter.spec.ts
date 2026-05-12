import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { PAYLOAD_URL, STORAGE_KEY, loadNodes, resetNodes, saveNodes } from '@/lib/payload-adapter'
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

describe('payload-adapter', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  describe('loadNodes', () => {
    it('returns cached nodes from localStorage without calling fetch', async () => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(SEED))
      const fetchMock = vi.fn<typeof fetch>()
      vi.stubGlobal('fetch', fetchMock)

      const result = await loadNodes()

      expect(result).toEqual(SEED)
      expect(fetchMock).not.toHaveBeenCalled()
    })

    it('fetches /payload.json on cache miss and seeds localStorage', async () => {
      const fetchMock = mockFetchOnce(SEED)

      const result = await loadNodes()

      expect(fetchMock).toHaveBeenCalledWith(PAYLOAD_URL)
      expect(result).toEqual(SEED)
      expect(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]')).toEqual(SEED)
    })

    it('throws when fetch responds with a non-ok status', async () => {
      mockFetchOnce([], false, 500)
      await expect(loadNodes()).rejects.toThrow(/Failed to load payload\.json/)
    })

    it('falls back to fetch when localStorage contains invalid JSON', async () => {
      localStorage.setItem(STORAGE_KEY, '{not json')
      const fetchMock = mockFetchOnce(SEED)

      const result = await loadNodes()

      expect(fetchMock).toHaveBeenCalled()
      expect(result).toEqual(SEED)
    })
  })

  describe('saveNodes', () => {
    it('writes the given nodes to localStorage', async () => {
      await saveNodes(SEED)
      expect(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]')).toEqual(SEED)
    })
  })

  describe('resetNodes', () => {
    it('clears localStorage and re-fetches the seed payload', async () => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([{ stale: true }]))
      const fetchMock = mockFetchOnce(SEED)

      const result = await resetNodes()

      expect(fetchMock).toHaveBeenCalledWith(PAYLOAD_URL)
      expect(result).toEqual(SEED)
      expect(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]')).toEqual(SEED)
    })
  })
})
