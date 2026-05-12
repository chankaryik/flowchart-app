import { describe, expect, it } from 'vitest'

import { createNode, nextNodeId } from '@/lib/node-factory'

const ID_PATTERN = /^[a-z0-9]{6}$/

describe('nextNodeId', () => {
  it('returns a 6-char lowercase alphanumeric id', () => {
    for (let i = 0; i < 20; i++) {
      expect(nextNodeId()).toMatch(ID_PATTERN)
    }
  })

  it('does not collide across many calls', () => {
    const ids = new Set<string>()
    for (let i = 0; i < 1000; i++) {
      ids.add(nextNodeId())
    }
    expect(ids.size).toBe(1000)
  })
})

describe('createNode("sendMessage")', () => {
  it('returns a SendMessage node with defaults and the supplied parent', () => {
    const node = createNode('sendMessage', 1)
    expect(node.type).toBe('sendMessage')
    expect(node.parentId).toBe(1)
    expect(node.id).toMatch(ID_PATTERN)
    expect(node.name).toBe('Send Message')
    expect(node.data.payload).toEqual([{ type: 'text', text: '' }])
  })

  it('merges partial data and name overrides', () => {
    const node = createNode('sendMessage', 'abc123', {
      name: 'Hi',
      payload: [{ type: 'text', text: 'hello' }],
    })
    expect(node.name).toBe('Hi')
    expect(node.data.payload).toEqual([{ type: 'text', text: 'hello' }])
  })
})

describe('createNode("addComment")', () => {
  it('returns an AddComment node with defaults', () => {
    const node = createNode('addComment', 'parent')
    expect(node.type).toBe('addComment')
    expect(node.parentId).toBe('parent')
    expect(node.name).toBe('Add Comment')
    expect(node.data.comment).toBe('')
  })

  it('respects partial overrides', () => {
    const node = createNode('addComment', 'parent', { name: 'Note', comment: 'hi' })
    expect(node.name).toBe('Note')
    expect(node.data.comment).toBe('hi')
  })
})

describe('createNode("dateTime")', () => {
  it('returns a dateTime node plus two connector children', () => {
    const { dateTime, connectors } = createNode('dateTime', 1)
    expect(dateTime.type).toBe('dateTime')
    expect(dateTime.parentId).toBe(1)
    expect(dateTime.name).toBe('Date & Time')
    expect(dateTime.data.timezone).toBe('UTC')
    expect(dateTime.data.action).toBe('businessHours')
    expect(dateTime.data.times).toEqual([{ day: 'mon', startTime: '09:00', endTime: '17:00' }])

    expect(connectors).toHaveLength(2)
    const [success, failure] = connectors
    expect(success.type).toBe('dateTimeConnector')
    expect(success.data.connectorType).toBe('success')
    expect(success.parentId).toBe(dateTime.id)
    expect(failure.data.connectorType).toBe('failure')
    expect(failure.parentId).toBe(dateTime.id)
  })

  it('wires connector ids into dateTime.data.connectors in success/failure order', () => {
    const { dateTime, connectors } = createNode('dateTime', 1)
    expect(dateTime.data.connectors).toEqual([connectors[0].id, connectors[1].id])
  })

  it('generates unique ids for the dateTime and its two connectors', () => {
    const { dateTime, connectors } = createNode('dateTime', 1)
    const ids = new Set([dateTime.id, connectors[0].id, connectors[1].id])
    expect(ids.size).toBe(3)
    for (const id of ids) {
      expect(id).toMatch(ID_PATTERN)
    }
  })
})
