import { customAlphabet } from 'nanoid'

import type {
  AddCommentNode,
  DateTimeConnectorNode,
  DateTimeNode,
  EditableNodeType,
  NodeId,
  SendMessageNode,
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

export function createNode(
  type: 'sendMessage',
  parentId: NodeId,
  partial?: Partial<SendMessageNode['data']> & { name?: string },
): SendMessageNode
export function createNode(
  type: 'addComment',
  parentId: NodeId,
  partial?: Partial<AddCommentNode['data']> & { name?: string },
): AddCommentNode
export function createNode(
  type: 'dateTime',
  parentId: NodeId,
  partial?: Partial<DateTimeNode['data']> & { name?: string },
): CreatedDateTime
export function createNode(
  type: EditableNodeType,
  parentId: NodeId,
  partial: Record<string, unknown> = {},
): SendMessageNode | AddCommentNode | CreatedDateTime {
  switch (type) {
    case 'sendMessage': {
      return buildSendMessage(parentId, partial as Partial<SendMessageNode['data']> & { name?: string })
    }
    case 'addComment': {
      return buildAddComment(parentId, partial as Partial<AddCommentNode['data']> & { name?: string })
    }
    case 'dateTime': {
      return buildDateTime(parentId, partial as Partial<DateTimeNode['data']> & { name?: string })
    }
  }
}

function buildSendMessage(
  parentId: NodeId,
  partial: Partial<SendMessageNode['data']> & { name?: string },
): SendMessageNode {
  return {
    id: nextNodeId(),
    parentId,
    type: 'sendMessage',
    name: partial.name ?? 'Send Message',
    data: {
      payload: partial.payload ?? [{ type: 'text', text: '' }],
    },
  }
}

function buildAddComment(
  parentId: NodeId,
  partial: Partial<AddCommentNode['data']> & { name?: string },
): AddCommentNode {
  return {
    id: nextNodeId(),
    parentId,
    type: 'addComment',
    name: partial.name ?? 'Add Comment',
    data: {
      comment: partial.comment ?? '',
    },
  }
}

function buildDateTime(
  parentId: NodeId,
  partial: Partial<DateTimeNode['data']> & { name?: string },
): CreatedDateTime {
  const dateTimeId = nextNodeId()
  const successId = nextNodeId()
  const failureId = nextNodeId()

  const dateTime: DateTimeNode = {
    id: dateTimeId,
    parentId,
    type: 'dateTime',
    name: partial.name ?? 'Date & Time',
    data: {
      times: partial.times ?? [{ day: 'mon', startTime: '09:00', endTime: '17:00' }],
      connectors: [successId, failureId],
      timezone: partial.timezone ?? 'UTC',
      action: partial.action ?? 'businessHours',
    },
  }

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
