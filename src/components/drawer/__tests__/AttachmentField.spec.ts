import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { nextTick } from 'vue'

import AttachmentField from '@/components/drawer/AttachmentField.vue'
import { ATTACHMENT_MAX_SIZE_BYTES } from '@/lib/attachment-rules'

function fakeFile(name: string, size = 1024): File {
  const file = new File(['x'], name)
  Object.defineProperty(file, 'size', { value: size })
  return file
}

function fireFiles(wrapper: ReturnType<typeof mount>, files: File[]): Promise<void> {
  const input = wrapper.find('[data-testid="attachment-input"]').element as HTMLInputElement
  Object.defineProperty(input, 'files', { configurable: true, value: files })
  input.dispatchEvent(new Event('change'))
  return nextTick()
}

describe('AttachmentField', () => {
  it('emits accepted files and clears rejection error on a clean upload', async () => {
    const wrapper = mount(AttachmentField, {
      props: { modelValue: [], files: [] },
    })
    await fireFiles(wrapper, [fakeFile('photo.png', 1024)])

    expect(wrapper.emitted('update:files')).toEqual([[[expect.any(File)]]])
    expect(wrapper.emitted('update:modelValue')).toEqual([[['photo.png']]])
    expect(wrapper.find('[data-testid="attachment-reject-error"]').exists()).toBe(false)
  })

  it('rejects unsupported file types without emitting and surfaces an inline error', async () => {
    const wrapper = mount(AttachmentField, {
      props: { modelValue: [], files: [] },
    })
    await fireFiles(wrapper, [fakeFile('clip.mp4', 1024)])

    expect(wrapper.emitted('update:files')).toBeUndefined()
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
    const err = wrapper.find('[data-testid="attachment-reject-error"]')
    expect(err.exists()).toBe(true)
    expect(err.text()).toContain('clip.mp4')
  })

  it('rejects files over the 10MB size cap', async () => {
    const wrapper = mount(AttachmentField, {
      props: { modelValue: [], files: [] },
    })
    await fireFiles(wrapper, [fakeFile('big.pdf', ATTACHMENT_MAX_SIZE_BYTES + 1)])

    expect(wrapper.emitted('update:files')).toBeUndefined()
    const err = wrapper.find('[data-testid="attachment-reject-error"]')
    expect(err.exists()).toBe(true)
    expect(err.text()).toContain('10MB')
  })

  it('emits the accepted subset when uploads are mixed', async () => {
    const wrapper = mount(AttachmentField, {
      props: { modelValue: [], files: [] },
    })
    await fireFiles(wrapper, [fakeFile('photo.png', 1024), fakeFile('clip.mp4', 1024)])

    const filesEmits = wrapper.emitted('update:files')
    expect(filesEmits).toHaveLength(1)
    const namesEmits = wrapper.emitted('update:modelValue')
    expect(namesEmits?.[0]?.[0]).toEqual(['photo.png'])
    expect(wrapper.find('[data-testid="attachment-reject-error"]').text()).toContain('clip.mp4')
  })

  it('clears the rejection error after a subsequent clean upload', async () => {
    const wrapper = mount(AttachmentField, {
      props: { modelValue: [], files: [] },
    })
    await fireFiles(wrapper, [fakeFile('clip.mp4', 1024)])
    expect(wrapper.find('[data-testid="attachment-reject-error"]').exists()).toBe(true)

    await fireFiles(wrapper, [fakeFile('photo.png', 1024)])
    expect(wrapper.find('[data-testid="attachment-reject-error"]').exists()).toBe(false)
  })
})
