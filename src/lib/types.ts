export type NodeId = string | number

export type Day = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun'

export const DAYS: readonly Day[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const

export type NodeType =
  | 'trigger'
  | 'sendMessage'
  | 'dateTime'
  | 'dateTimeConnector'
  | 'addComment'

export type EditableNodeType = Exclude<NodeType, 'trigger' | 'dateTimeConnector'>

export type SendMessagePayloadItem =
  | { type: 'text'; text: string }
  | { type: 'attachment'; attachment: string }

export type BusinessHoursRow = {
  day: Day
  startTime: string
  endTime: string
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
  data: {
    payload: SendMessagePayloadItem[]
  }
}

export type DateTimeNode = {
  id: NodeId
  parentId: NodeId
  type: 'dateTime'
  name: string
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

export type ValidationResult = { ok: true } | { ok: false; message: string }
