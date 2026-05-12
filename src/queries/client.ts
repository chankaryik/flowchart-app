import { QueryClient } from '@tanstack/vue-query'

export const NODES_QUERY_KEY = ['nodes'] as const

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        refetchOnWindowFocus: false,
        networkMode: 'always',
        staleTime: Infinity,
        gcTime: 60 * 60 * 1000,
      },
    },
  })
}
