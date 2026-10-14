import { expect, test } from 'bun:test'

import { createEditor } from '@open-pencil/core/editor'

import { bindLayoutNotifications } from '@/app/editor/layout/notifications'
import { toast } from '@/app/shell/ui'

for (const axis of ['width', 'height'] as const) {
  test(`${axis}: automatic conversions produce neutral notices with layer names, once per action`, () => {
    const editor = createEditor()
    const stop = bindLayoutNotifications(editor)
    const existing = new Set(toast.toasts.value.map(({ id }) => id))
    const notices = () => toast.toasts.value.filter(({ id }) => !existing.has(id))
    try {
      const frame = editor.graph.createNode('FRAME', editor.state.currentPageId, {
        name: 'Purchase button',
        layoutMode: 'VERTICAL',
        width: 140,
        height: 40,
        primaryAxisSizing: 'HUG',
        counterAxisSizing: 'HUG'
      })
      const label = editor.graph.createNode('FRAME', frame.id, {
        name: 'Purchase label',
        width: 140,
        height: 40
      })
      editor.setLayoutSizing(label.id, axis, 'FILL')
      expect(notices()).toHaveLength(1)
      expect(notices()[0]).toMatchObject({ variant: 'default', count: 1 })
      expect(notices()[0].message).toContain(frame.name)
      expect(notices()[0].message).toContain(label.name)
      editor.undoAction()
      editor.redoAction()
      expect(notices()).toHaveLength(1)
      editor.setLayoutSizing(frame.id, axis, 'HUG')
      expect(notices()).toHaveLength(2)
      expect(notices()[1]).toMatchObject({ variant: 'default', count: 1 })
      expect(notices()[1].message).toContain(frame.name)
      // A closed document must not keep sending notices.
      stop()
      editor.setLayoutSizing(label.id, axis, 'FILL')
      expect(notices()).toHaveLength(2)
    } finally {
      stop()
      editor.dispose()
      for (const entry of notices()) toast.remove(entry.id)
    }
  })
}
