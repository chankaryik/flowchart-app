import { customAlphabet } from 'nanoid'

import {
  DAYS,
  type AddCommentNode,
  type BusinessHoursRow,
  type DateTimeConnectorNode,
  type DateTimeNode,
  type EditableNodeType,
  type NodeId,
  type SendMessageNode,
} from '@/lib/types'

const ID_ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789'
const ID_LENGTH = 6
const generateId = customAlphabet(ID_ALPHABET, ID_LENGTH)

export type CreatedDateTime = {
  dateTime: DateTimeNode
  connectors: [DateTimeConnectorNode, DateTimeConnectorNode]
}

export type CreateNodeResult<T extends EditableNodeType> = T extends 'sendMessage'
  ? SendMessageNode
  : T extends 'addComment'
    ? AddCommentNode
    : T extends 'dateTime'
      ? CreatedDateTime
      : never

export function nextNodeId(): string {
  return generateId()
}

type SendMessagePartial = Partial<SendMessageNode['data']> & { name?: string; description?: string }
type AddCommentPartial = Partial<AddCommentNode['data']> & { name?: string; description?: string }
type DateTimePartial = Partial<DateTimeNode['data']> & { name?: string; description?: string }

export function createNode(
  type: 'sendMessage',
  parentId: NodeId,
  partial?: SendMessagePartial,
): SendMessageNode
export function createNode(
  type: 'addComment',
  parentId: NodeId,
  partial?: AddCommentPartial,
): AddCommentNode
export function createNode(
  type: 'dateTime',
  parentId: NodeId,
  partial?: DateTimePartial,
): CreatedDateTime
export function createNode(
  type: EditableNodeType,
  parentId: NodeId,
  partial: Record<string, unknown> = {},
): SendMessageNode | AddCommentNode | CreatedDateTime {
  switch (type) {
    case 'sendMessage': {
      return buildSendMessage(parentId, partial as SendMessagePartial)
    }
    case 'addComment': {
      return buildAddComment(parentId, partial as AddCommentPartial)
    }
    case 'dateTime': {
      return buildDateTime(parentId, partial as DateTimePartial)
    }
  }
}

function trimmedDescription(value: string | undefined): string | undefined {
  if (value == null) return undefined
  const trimmed = value.trim()
  return trimmed.length === 0 ? undefined : trimmed
}

function buildSendMessage(parentId: NodeId, partial: SendMessagePartial): SendMessageNode {
  const node: SendMessageNode = {
    id: nextNodeId(),
    parentId,
    type: 'sendMessage',
    name: partial.name ?? 'Send Message',
    data: {
      payload: partial.payload ?? [{ type: 'text', text: '' }],
    },
  }
  const description = trimmedDescription(partial.description)
  if (description != null) node.description = description
  return node
}

function buildAddComment(parentId: NodeId, partial: AddCommentPartial): AddCommentNode {
  const node: AddCommentNode = {
    id: nextNodeId(),
    parentId,
    type: 'addComment',
    name: partial.name ?? 'Add Comment',
    data: {
      comment: partial.comment ?? '',
    },
  }
  const description = trimmedDescription(partial.description)
  if (description != null) node.description = description
  return node
}

function defaultBusinessHours(): BusinessHoursRow[] {
  return DAYS.map((day) => ({ day, startTime: '09:00', endTime: '17:00' }))
}

function buildDateTime(parentId: NodeId, partial: DateTimePartial): CreatedDateTime {
  const dateTimeId = nextNodeId()
  const successId = nextNodeId()
  const failureId = nextNodeId()

  const dateTime: DateTimeNode = {
    id: dateTimeId,
    parentId,
    type: 'dateTime',
    name: partial.name ?? 'Date & Time',
    data: {
      times: partial.times ?? defaultBusinessHours(),
      connectors: [successId, failureId],
      timezone: partial.timezone ?? 'UTC',
      action: partial.action ?? 'businessHours',
    },
  }
  const description = trimmedDescription(partial.description)
  if (description != null) dateTime.description = description

  const success: DateTimeConnectorNode = {
    id: successId,
    parentId: dateTimeId,
    type: 'dateTimeConnector',
    name: 'Success',
    data: { connectorType: 'success' },
  }

  const failure: DateTimeConnectorNode = {
    id: failureId,
    parentId: dateTimeId,
    type: 'dateTimeConnector',
    name: 'Failure',
    data: { connectorType: 'failure' },
  }

  return { dateTime, connectors: [success, failure] }
}
