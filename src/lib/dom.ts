export function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  if (target.isContentEditable) return true
  // jsdom's isContentEditable getter doesn't always reflect the attribute; check it directly.
  const ce = target.getAttribute('contenteditable')
  if (ce != null && ce !== 'false') return true
  const tag = target.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT'
}
