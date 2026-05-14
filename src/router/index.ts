import { createRouter, createWebHistory, type RouteLocationNormalized } from 'vue-router'
import { toast } from 'vue-sonner'

import { STORAGE_KEY, isPersistEnabled } from '@/lib/payload-adapter'
import { sameId, type FlowNode } from '@/lib/types'

const FlowChartView = () => import('@/views/FlowChartView.vue')

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'flow',
      component: FlowChartView,
    },
    {
      path: '/node/:id',
      name: 'node-details',
      component: FlowChartView,
      beforeEnter: (to) => guardNodeRoute(to),
    },
  ],
})

function guardNodeRoute(to: RouteLocationNormalized) {
  const rawId = to.params.id
  const id = Array.isArray(rawId) ? rawId[0] : rawId
  if (id == null || id === '') {
    toast.warning('No node id in URL')
    return { path: '/' }
  }

  // Use a sync peek into localStorage so deep links land correctly when the
  // payload is already cached. When localStorage is empty (first visit) the
  // view performs the same check after the query hydrates the store.
  const cached = peekCachedNodes()
  if (cached == null) return true

  const match = cached.find((node) => sameId(node.id, id))
  if (match == null) {
    toast.warning(`Node "${id}" not found`)
    return { path: '/' }
  }
  if (match.type === 'dateTimeConnector') {
    toast.info('Connectors are display-only')
    return { path: '/' }
  }
  return true
}

function peekCachedNodes(): FlowNode[] | null {
  if (typeof localStorage === 'undefined') return null
  if (!isPersistEnabled()) return null
  const raw = localStorage.getItem(STORAGE_KEY)
  if (raw == null) return null
  try {
    return JSON.parse(raw) as FlowNode[]
  } catch {
    return null
  }
}

export default router
