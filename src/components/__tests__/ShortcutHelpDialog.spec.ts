import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Component } from 'vue'

import ShortcutHelpDialog from '../ShortcutHelpDialog.vue'

// Reka-ui's DialogPortal renders into a portal jsdom doesn't surface. Stub the
// primitives so slots render inline and we can assert on the contents.
const dialogStubs: Record<string, Component> = {
  Dialog: {
    name: 'Dialog',
    props: ['open'],
    emits: ['update:open'],
    template: '<div data-stub="dialog" :data-open="open"><slot /></div>',
  },
  DialogContent: { template: '<div><slot /></div>' },
  DialogHeader: { template: '<div><slot /></div>' },
  DialogTitle: { template: '<h2><slot /></h2>' },
  DialogDescription: { template: '<p><slot /></p>' },
}

function mountDialog(open = true) {
  return mount(ShortcutHelpDialog, {
    props: { open },
    global: { stubs: dialogStubs },
  })
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('ShortcutHelpDialog', () => {
  it('renders the navigation shortcuts including arrow keys, Enter, and Esc', () => {
    const wrapper = mountDialog()
    const text = wrapper.text()
    expect(text).toMatch(/Focus next node/i)
    expect(text).toMatch(/Move focus to an adjacent node/i)
    expect(text).toMatch(/Open details for the focused node/i)
    expect(text).toMatch(/Close the open drawer/i)
  })

  it('exposes the help "?" shortcut', () => {
    const wrapper = mountDialog()
    expect(wrapper.text()).toMatch(/Show this help/i)
  })

  it('uses Ctrl as the modifier on non-mac platforms and shows the Ctrl+Y redo alias', () => {
    vi.stubGlobal('navigator', { platform: 'Win32', userAgent: 'win' })
    const wrapper = mountDialog()
    const kbds = wrapper.findAll('kbd').map((el) => el.text())
    expect(kbds).toContain('Ctrl')
    expect(kbds).toContain('Y')
    expect(kbds).not.toContain('⌘')
  })

  it('uses ⌘ as the modifier on mac and omits the Ctrl+Y alias', () => {
    vi.stubGlobal('navigator', { platform: 'MacIntel', userAgent: 'mac' })
    const wrapper = mountDialog()
    const kbds = wrapper.findAll('kbd').map((el) => el.text())
    expect(kbds).toContain('⌘')
    expect(kbds).not.toContain('Y')
  })

  it('emits update:open(false) when the dialog requests close', async () => {
    const wrapper = mountDialog(true)
    const dialog = wrapper.findComponent({ name: 'Dialog' })
    dialog.vm.$emit('update:open', false)
    await wrapper.vm.$nextTick()
    const events = wrapper.emitted('update:open')
    expect(events).toBeTruthy()
    expect(events![events!.length - 1]).toEqual([false])
  })
})
