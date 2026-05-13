import { idKey, type FlowNode } from '@/lib/types'

export type Position = { x: number; y: number }

export const NODE_WIDTH = 220
export const NODE_HEIGHT = 80
export const H_GAP = 40
export const V_GAP = 80

export const layoutKey = idKey

export function computeLayout(nodes: FlowNode[]): Record<string, Position> {
  if (nodes.length === 0) return {}

  const idSet = new Set(nodes.map((n) => layoutKey(n.id)))
  const childrenByParent = new Map<string, FlowNode[]>()
  for (const node of nodes) {
    const parentKey = layoutKey(node.parentId)
    if (!idSet.has(parentKey)) continue
    const list = childrenByParent.get(parentKey) ?? []
    list.push(node)
    childrenByParent.set(parentKey, list)
  }

  const roots = nodes.filter((n) => !idSet.has(layoutKey(n.parentId)))
  const positions: Record<string, Position> = {}

  function subtreeWidth(node: FlowNode): number {
    const children = childrenByParent.get(layoutKey(node.id)) ?? []
    if (children.length === 0) return NODE_WIDTH
    const total =
      children.reduce((acc, child) => acc + subtreeWidth(child), 0) +
      (children.length - 1) * H_GAP
    return Math.max(NODE_WIDTH, total)
  }

  function place(node: FlowNode, centerX: number, y: number): void {
    const key = layoutKey(node.id)
    positions[key] = { x: centerX - NODE_WIDTH / 2, y }
    const children = childrenByParent.get(key) ?? []
    if (children.length === 0) return
    const widths = children.map(subtreeWidth)
    const totalWidth = widths.reduce((a, b) => a + b, 0) + (children.length - 1) * H_GAP
    let cursor = centerX - totalWidth / 2
    children.forEach((child, index) => {
      const width = widths[index]
      if (width == null) return
      place(child, cursor + width / 2, y + V_GAP + NODE_HEIGHT)
      cursor += width + H_GAP
    })
  }

  let cursorX = 0
  for (const root of roots) {
    const width = subtreeWidth(root)
    place(root, cursorX + width / 2, 0)
    cursorX += width + H_GAP
  }

  return positions
}
