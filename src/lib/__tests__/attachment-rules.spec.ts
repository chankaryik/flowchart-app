import { describe, expect, it } from 'vitest'

import {
  ATTACHMENT_ACCEPT_ATTR,
  ATTACHMENT_MAX_SIZE_BYTES,
  formatAttachmentRejections,
  getFileExtension,
  validateAttachmentFile,
  type AttachmentRejection,
} from '@/lib/attachment-rules'

function fakeFile(name: string, size: number): File {
  const file = new File(['x'], name)
  Object.defineProperty(file, 'size', { value: size })
  return file
}

describe('getFileExtension', () => {
  it('lowercases the extension', () => {
    expect(getFileExtension('Photo.PNG')).toBe('png')
  })

  it('returns empty string when there is no dot', () => {
    expect(getFileExtension('README')).toBe('')
  })

  it('reads from the last dot for multi-dot names', () => {
    expect(getFileExtension('archive.tar.gz')).toBe('gz')
  })
})

describe('ATTACHMENT_ACCEPT_ATTR', () => {
  it('includes every supported image and doc extension as a dotted entry', () => {
    const entries = ATTACHMENT_ACCEPT_ATTR.split(',')
    for (const ext of [
      'png',
      'jpg',
      'jpeg',
      'gif',
      'webp',
      'svg',
      'pdf',
      'doc',
      'docx',
      'xls',
      'xlsx',
      'ppt',
      'pptx',
      'txt',
      'csv',
    ]) {
      expect(entries).toContain(`.${ext}`)
    }
  })
})

describe('validateAttachmentFile', () => {
  it('accepts a supported type under the size cap', () => {
    expect(validateAttachmentFile(fakeFile('photo.png', 1024))).toBeNull()
    expect(validateAttachmentFile(fakeFile('report.pdf', 5 * 1024 * 1024))).toBeNull()
    expect(validateAttachmentFile(fakeFile('table.XLSX', 1024))).toBeNull()
  })

  it('rejects unsupported types', () => {
    expect(validateAttachmentFile(fakeFile('clip.mp4', 1024))).toBe('type')
    expect(validateAttachmentFile(fakeFile('archive.zip', 1024))).toBe('type')
    expect(validateAttachmentFile(fakeFile('README', 1024))).toBe('type')
  })

  it('rejects files over the 10MB cap', () => {
    expect(validateAttachmentFile(fakeFile('big.pdf', ATTACHMENT_MAX_SIZE_BYTES + 1))).toBe('size')
  })

  it('accepts files exactly at the size cap', () => {
    expect(validateAttachmentFile(fakeFile('edge.pdf', ATTACHMENT_MAX_SIZE_BYTES))).toBeNull()
  })

  it('reports type before size when both fail', () => {
    expect(validateAttachmentFile(fakeFile('huge.mp4', ATTACHMENT_MAX_SIZE_BYTES + 1))).toBe('type')
  })
})

describe('formatAttachmentRejections', () => {
  it('returns empty string for no rejections', () => {
    expect(formatAttachmentRejections([])).toBe('')
  })

  it('names the file for a single type rejection', () => {
    const rejections: AttachmentRejection[] = [{ name: 'clip.mp4', reason: 'type' }]
    expect(formatAttachmentRejections(rejections)).toContain('clip.mp4')
    expect(formatAttachmentRejections(rejections)).toMatch(/supported/i)
  })

  it('names the file for a single size rejection', () => {
    const rejections: AttachmentRejection[] = [{ name: 'big.pdf', reason: 'size' }]
    expect(formatAttachmentRejections(rejections)).toContain('big.pdf')
    expect(formatAttachmentRejections(rejections)).toContain('10MB')
  })

  it('summarizes multiple type rejections', () => {
    const rejections: AttachmentRejection[] = [
      { name: 'a.mp4', reason: 'type' },
      { name: 'b.zip', reason: 'type' },
    ]
    expect(formatAttachmentRejections(rejections)).toMatch(/2 files/)
    expect(formatAttachmentRejections(rejections)).toMatch(/type/i)
  })

  it('summarizes mixed rejection reasons', () => {
    const rejections: AttachmentRejection[] = [
      { name: 'a.mp4', reason: 'type' },
      { name: 'b.pdf', reason: 'size' },
    ]
    const msg = formatAttachmentRejections(rejections)
    expect(msg).toMatch(/2 files/)
    expect(msg).toContain('10MB')
  })
})
