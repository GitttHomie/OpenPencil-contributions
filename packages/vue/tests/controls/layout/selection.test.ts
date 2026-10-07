import { expect, test } from 'bun:test'

import { createApp, effectScope } from 'vue'

import { createEditor } from '@open-pencil/core/editor'

import { useSelectionLayout } from '#vue/controls/layout/selection'
import { EDITOR_KEY } from '#vue/editor/context'

function setup() {
  const editor = createEditor()
  const first = editor.graph.createNode('FRAME', editor.state.currentPageId, {
    width: 100,
    height: 60,
    minWidth: 40,
    layoutMode: 'HORIZONTAL',
    primaryAxisAlign: 'SPACE_BETWEEN'
  })
  const second = editor.graph.createNode('COMPONENT', editor.state.currentPageId, {
    width: 180,
    height: 90,
    layoutMode: 'VERTICAL'
  })
  editor.select([first.id, second.id])
  const app = createApp({})
  app.provide(EDITOR_KEY, editor)
  const scope = effectScope()
  const controls = scope.run(() => app.runWithContext(useSelectionLayout))
  if (!controls) throw new Error('Missing layout controls')
  return {
    editor,
    first,
    second,
    controls,
    dispose() {
      scope.stop()
      editor.dispose()
    }
  }
}

test('adding a missing size limit preserves an existing limit and undo restores both', () => {
  const scene = setup()
  try {
    scene.controls.setSizeLimit('minWidth', 'add')
    expect([scene.first.minWidth, scene.second.minWidth]).toEqual([40, 180])
    scene.editor.undoAction()
    expect([scene.first.minWidth, scene.second.minWidth]).toEqual([40, null])
    scene.editor.redoAction()
    scene.controls.setSizeLimit('minWidth', 'remove')
    expect([scene.first.minWidth, scene.second.minWidth]).toEqual([null, null])
    scene.editor.undoAction()
    expect([scene.first.minWidth, scene.second.minWidth]).toEqual([40, 180])
  } finally {
    scene.dispose()
  }
})

test('physical alignment respects different flow directions and preserves automatic gaps', () => {
  const scene = setup()
  try {
    scene.controls.setPhysicalAlignment('MAX', 'CENTER')
    expect([scene.first.primaryAxisAlign, scene.first.counterAxisAlign]).toEqual([
      'SPACE_BETWEEN',
      'CENTER'
    ])
    expect([scene.second.primaryAxisAlign, scene.second.counterAxisAlign]).toEqual([
      'CENTER',
      'MAX'
    ])
    scene.editor.undoAction()
    expect([scene.first.primaryAxisAlign, scene.first.counterAxisAlign]).toEqual([
      'SPACE_BETWEEN',
      'MIN'
    ])
    expect([scene.second.primaryAxisAlign, scene.second.counterAxisAlign]).toEqual(['MIN', 'MIN'])
    scene.controls.setWrap(true)
    expect([scene.first.layoutWrap, scene.second.layoutWrap]).toEqual(['WRAP', 'WRAP'])
    expect(scene.first.primaryAxisAlign).toBe('MIN')
    scene.editor.undoAction()
    expect([scene.first.layoutWrap, scene.second.layoutWrap]).toEqual(['NO_WRAP', 'NO_WRAP'])
    expect(scene.first.primaryAxisAlign).toBe('SPACE_BETWEEN')
  } finally {
    scene.dispose()
  }
})
