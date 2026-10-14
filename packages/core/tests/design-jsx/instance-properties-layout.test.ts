import { expect, test } from 'bun:test'

import { expectDefined } from '#core-tests/helpers/assert'
import { createSavedActionCell } from '#core-tests/helpers/fig/action-cell'

import { renderJSX } from '#core/design-jsx/renderer'
import { FigmaAPI } from '#core/figma-api'
import { exportFigFile, parseFigFile } from '#core/io'
import { initCodec } from '#core/kiwi'
import { computeAllLayouts } from '#core/layout'

test('JSX visibility assignments release saved Hug measurements throughout an instance and its list', async () => {
  const { editor, graph, main, action, list } = createSavedActionCell()
  try {
    const results = await renderJSX(
      graph,
      `
      <>
        <Instance of="${main.id}" properties={{"show-action": false}} />
        <Instance of="${main.id}" properties={{"show-action": "false"}} />
      </>
    `,
      { parentId: list.id }
    )
    const rows = results.map((result) => expectDefined(graph.getNode(result.id)))
    expect(rows.map((row) => row.height)).toEqual([68, 68])
    expect(rows.map((row) => row.y)).toEqual([0, 76])
    expect(list.height).toBe(144)
    expect(action.visible).toBe(true)
    expect(main.height).toBe(94)
    const first = expectDefined(rows[0])
    editor.setInstanceComponentProperty(first.id, 'show-action', 'true')
    expect(first.height).toBe(94)
    expect(list.height).toBe(170)
    editor.undo.undo()
    expect(first.height).toBe(68)
    expect(list.height).toBe(144)
    editor.undo.redo()
    expect(first.height).toBe(94)
    editor.undo.undo()

    await initCodec()
    const saved = await exportFigFile(graph)
    const restored = await parseFigFile(saved.slice().buffer)
    computeAllLayouts(restored, expectDefined(restored.getPages()[0]).id)
    const restoredList = expectDefined(
      Array.from(restored.getAllNodes()).find((node) => node.name === 'Settings')
    )
    expect(restoredList.height).toBe(144)
    expect(restored.getChildren(restoredList.id).map((node) => node.height)).toEqual([68, 68])
  } finally {
    editor.dispose()
  }
})

test('an explicitly fixed instance height remains fixed when JSX hides its action', async () => {
  const { editor, graph, main, list } = createSavedActionCell()
  try {
    const [result] = await renderJSX(
      graph,
      `<Instance of="${main.id}" h={120} properties={{"show-action":"false"}} />`,
      { parentId: list.id }
    )
    const row = expectDefined(graph.getNode(expectDefined(result).id))
    expect(row.primaryAxisSizing).toBe('FIXED')
    expect(row.height).toBe(120)
    expect(list.height).toBe(120)
  } finally {
    editor.dispose()
  }
})

test('a Fixed component and its Fill contents stretch through an instance that fills its frame', async () => {
  const { editor, graph } = createSavedActionCell()
  try {
    const main = graph.createNode('COMPONENT', editor.state.currentPageId, {
      name: 'Stretch cell',
      layoutMode: 'VERTICAL',
      primaryAxisSizing: 'FIXED',
      counterAxisSizing: 'FIXED',
      width: 240,
      height: 100
    })
    const content = graph.createNode('FRAME', main.id, {
      name: 'Fill contents',
      layoutGrow: 1,
      layoutAlignSelf: 'STRETCH',
      width: 240,
      height: 100
    })
    const [result] = await renderJSX(
      graph,
      `
      <Frame w={400} h={300} flex="col" p={20}>
        <Instance of="${main.id}" w="fill" h="fill" />
      </Frame>
    `
    )
    const frame = expectDefined(graph.getNode(expectDefined(result).id))
    const instance = expectDefined(graph.getChildren(frame.id)[0])
    const contents = expectDefined(graph.getChildren(instance.id)[0])
    expect([instance.width, instance.height]).toEqual([360, 260])
    expect([contents.width, contents.height]).toEqual([360, 260])
    const api = new FigmaAPI(graph)
    expectDefined(api.getNodeById(frame.id)).resize(500, 350)
    const proxy = expectDefined(api.getNodeById(instance.id))
    expect([proxy.width, proxy.height]).toEqual([460, 310])
    expect([contents.width, contents.height]).toEqual([460, 310])
    expect([main.width, main.height]).toEqual([240, 100])
    expect([content.width, content.height]).toEqual([240, 100])
  } finally {
    editor.dispose()
  }
})
