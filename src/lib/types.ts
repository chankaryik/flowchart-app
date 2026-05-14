export type NodeId = string | number

export function idKey(id: NodeId): string {
  return String(id)
}

export function sameId(a: NodeId, b: NodeId): boolean {
  return String(a) === String(b)
}

export type Day = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun'

export const DAYS: readonly Day[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const

export type NodeType = 'trigger' | 'sendMessage' | 'dateTime' | 'dateTimeConnector' | 'addComment'

export type EditableNodeType = Exclude<NodeType, 'trigger' | 'dateTimeConnector'>

export type SendMessagePayloadItem =
  | { type: 'text'; text: string }
  | { type: 'attachment'; attachments: string[] }

export type BusinessHoursRow = {
  day: Day
  startTime: string
  endTime: string
  closed?: boolean
}

export type ConnectorType = 'success' | 'failure'

export type TriggerNode = {
  id: NodeId
  parentId: NodeId
  type: 'trigger'
  data: {
    type: string
    oncePerContact: boolean
  }
}

export type SendMessageNode = {
  id: NodeId
  parentId: NodeId
  type: 'sendMessage'
  name: string
  // Optional because payload.json-seeded nodes don't carry one; only set on
  // nodes the user creates through the Create New Node form (REQUIREMENTS.md).
  description?: string
  data: {
    payload: SendMessagePayloadItem[]
  }
}

export type DateTimeNode = {
  id: NodeId
  parentId: NodeId
  type: 'dateTime'
  name: string
  description?: string
  data: {
    times: BusinessHoursRow[]
    connectors: NodeId[]
    timezone: string
    action: string
  }
}

export type DateTimeConnectorNode = {
  id: NodeId
  parentId: NodeId
  type: 'dateTimeConnector'
  name: string
  data: {
    connectorType: ConnectorType
  }
}

export type AddCommentNode = {
  id: NodeId
  parentId: NodeId
  type: 'addComment'
  name: string
  description?: string
  data: {
    comment: string
  }
}

export type FlowNode =
  | TriggerNode
  | SendMessageNode
  | DateTimeNode
  | DateTimeConnectorNode
  | AddCommentNode
