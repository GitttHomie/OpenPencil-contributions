import { expect, test } from 'bun:test'

import { expectDefined } from '#core-tests/helpers/assert'
import { createSavedActionCell } from '#core-tests/helpers/fig/action-cell'

import { exportFigFile, parseFigFile } from '#core/io'
import { initCodec } from '#core/kiwi'
import { computeAllLayouts } from '#core/layout'

test('component visibility defaults resize saved instances without overriding explicit choices', async () => {
  const { editor, graph, main, list } = createSavedActionCell()
  try {
    const inherited = expectDefined(graph.createInstance(main.id, list.id))
    const shown = expectDefined(graph.createInstance(main.id, list.id))
    const hidden = expectDefined(graph.createInstance(main.id, list.id))
    await Promise.resolve()
    editor.setInstanceComponentProperty(shown.id, 'show-action', 'true')
    editor.setInstanceComponentProperty(hidden.id, 'show-action', 'false')
    // Model the persisted measurements of a reopened document.
    graph.applyImportedStateDuring(() => {
      for (const node of graph.getAllNodes()) {
        graph.updateNode(node.id, {
          source: { ...node.source, editedFields: [] },
          derivedLayout:
            node.layoutMode !== 'NONE' ? { width: node.width, height: node.height } : null
        })
      }
    })
    await Promise.resolve()
    editor.undo.clear()
    editor.setComponentPropertyDefault(main.id, 'show-action', 'false')
    await Promise.resolve()
    expect(main.height).toBe(68)
    expect([inherited.height, shown.height, hidden.height]).toEqual([68, 94, 68])
    expect([inherited.y, shown.y, hidden.y, list.height]).toEqual([0, 76, 178, 246])
    expect(inherited.componentPropertyAssignments).toEqual({})
    expect(shown.componentPropertyAssignments).toEqual({ 'show-action': 'true' })
    expect(hidden.componentPropertyAssignments).toEqual({ 'show-action': 'false' })

    editor.undo.undo()
    await Promise.resolve()
    expect(main.height).toBe(94)
    expect([inherited.height, shown.height, hidden.height, list.height]).toEqual([94, 94, 68, 272])
    editor.undo.redo()
    await Promise.resolve()
    expect([inherited.height, shown.height, hidden.height, list.height]).toEqual([68, 94, 68, 246])
    await initCodec()
    const saved = await exportFigFile(graph)
    const restored = await parseFigFile(saved.slice().buffer)
    computeAllLayouts(restored)
    const restoredList = expectDefined(
      Array.from(restored.getAllNodes()).find((node) => node.name === 'Settings')
    )
    expect(restoredList.height).toBe(246)
    expect(restored.getChildren(restoredList.id).map((node) => node.height)).toEqual([68, 94, 68])
  } finally {
    editor.dispose()
  }
})

test('unlinked layer visibility releases saved bounds through nested component instances', async () => {
  const { editor, graph, main, action, list } = createSavedActionCell()
  try {
    graph.updateNode(main.id, { componentPropertyDefinitions: [] })
    graph.updateNode(action.id, { componentPropertyReferences: [] })
    const outer = graph.createNode('COMPONENT', editor.state.currentPageId, {
      name: 'Outer',
      width: 262,
      layoutMode: 'VERTICAL',
      primaryAxisSizing: 'HUG',
      counterAxisSizing: 'FIXED',
      paddingTop: 10,
      paddingBottom: 10
    })
    const nested = expectDefined(graph.createInstance(main.id, outer.id))
    const occurrence = expectDefined(graph.createInstance(outer.id, list.id))
    await Promise.resolve()
    // Only occurrences retain saved bounds: source invalidation alone cannot fix these.
    graph.applyImportedStateDuring(() => {
      for (const node of graph.getAllNodes()) {
        const inOccurrence = graph.closest(node.id, (parent) => parent.type === 'INSTANCE')
        graph.updateNode(node.id, {
          source: { ...node.source, editedFields: [] },
          derivedLayout:
            inOccurrence && node.layoutMode !== 'NONE'
              ? { width: node.width, height: node.height }
              : null
        })
      }
    })
    expect(occurrence.height).toBe(114)
    editor.toggleNodeVisibility(action.id)
    await Promise.resolve()
    expect(main.height).toBe(68)
    expect(nested.height).toBe(68)
    expect([outer.height, occurrence.height, list.height]).toEqual([88, 88, 88])
    editor.toggleNodeVisibility(action.id)
    await Promise.resolve()
    expect([outer.height, occurrence.height, list.height]).toEqual([114, 114, 114])
  } finally {
    editor.dispose()
  }
})
