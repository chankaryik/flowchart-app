export const ATTACHMENT_MAX_SIZE_BYTES = 10 * 1024 * 1024
export const ATTACHMENT_MAX_SIZE_LABEL = '10MB'

export const ATTACHMENT_IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'] as const

export const ATTACHMENT_DOC_EXTENSIONS = [
  'pdf',
  'doc',
  'docx',
  'xls',
  'xlsx',
  'ppt',
  'pptx',
  'txt',
  'csv',
] as const

export const ATTACHMENT_ALLOWED_EXTENSIONS: readonly string[] = [
  ...ATTACHMENT_IMAGE_EXTENSIONS,
  ...ATTACHMENT_DOC_EXTENSIONS,
]

export const ATTACHMENT_ACCEPT_ATTR = ATTACHMENT_ALLOWED_EXTENSIONS.map((ext) => `.${ext}`).join(
  ',',
)

export type AttachmentRejectReason = 'type' | 'size'

export type AttachmentRejection = {
  name: string
  reason: AttachmentRejectReason
}

export function getFileExtension(name: string): string {
  const dot = name.lastIndexOf('.')
  return dot >= 0 ? name.slice(dot + 1).toLowerCase() : ''
}

export function validateAttachmentFile(file: File): AttachmentRejectReason | null {
  if (!ATTACHMENT_ALLOWED_EXTENSIONS.includes(getFileExtension(file.name))) return 'type'
  if (file.size > ATTACHMENT_MAX_SIZE_BYTES) return 'size'
  return null
}

export function formatAttachmentRejections(rejections: AttachmentRejection[]): string {
  if (rejections.length === 0) return ''
  if (rejections.length === 1) {
    const r = rejections[0]!
    return r.reason === 'type'
      ? `${r.name} isn't a supported file type.`
      : `${r.name} exceeds the ${ATTACHMENT_MAX_SIZE_LABEL} limit.`
  }
  const typeCount = rejections.filter((r) => r.reason === 'type').length
  const sizeCount = rejections.length - typeCount
  if (typeCount > 0 && sizeCount === 0) {
    return `${typeCount} files were rejected — unsupported file type.`
  }
  if (sizeCount > 0 && typeCount === 0) {
    return `${sizeCount} files were rejected — over the ${ATTACHMENT_MAX_SIZE_LABEL} limit.`
  }
  return `${rejections.length} files were rejected — unsupported type or over ${ATTACHMENT_MAX_SIZE_LABEL}.`
}
