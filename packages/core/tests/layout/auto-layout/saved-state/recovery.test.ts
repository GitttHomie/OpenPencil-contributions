import { expect, test } from 'bun:test'

import { expectDefined } from '#core-tests/helpers/assert'
import { unzipSync, zipSync } from 'fflate'

import { SceneGraph, type SceneNode } from '@open-pencil/scene-graph'

import { createEditor } from '#core/editor'
import { exportFigFile, parseFigFile } from '#core/io'
import { initCodec } from '#core/kiwi'
import { populateFigPage } from '#core/kiwi/fig/session/document-state'
import { releaseStaleSavedLayouts } from '#core/kiwi/fig/session/layout'
import { computeAllLayouts } from '#core/layout'

async function savedWithStalePadding(horizontal = false) {
  await initCodec()
  const graph = new SceneGraph()
  const page = expectDefined(graph.getPages()[0])
  const main = graph.createNode('COMPONENT', page.id, {
    name: 'Card',
    width: horizontal ? 104 : 341,
    height: horizontal ? 341 : 104,
    layoutMode: horizontal ? 'HORIZONTAL' : 'VERTICAL',
    primaryAxisSizing: 'HUG',
    counterAxisSizing: 'FIXED',
    fills: [{ type: 'SOLID', color: { r: 1, g: 1, b: 1, a: 1 }, visible: true, opacity: 1 }]
  })
  const content = graph.createNode('FRAME', main.id, {
    name: 'Content',
    x: horizontal ? 16 : 24,
    y: horizontal ? 24 : 16,
    width: horizontal ? 72 : 293,
    height: horizontal ? 293 : 72,
    layoutAlignSelf: 'STRETCH',
    layoutMode: horizontal ? 'VERTICAL' : 'HORIZONTAL',
    primaryAxisSizing: 'FIXED',
    counterAxisSizing: 'HUG',
    fills: [{ type: 'SOLID', color: { r: 1, g: 1, b: 1, a: 1 }, visible: true, opacity: 1 }]
  })
  graph.createNode('FRAME', content.id, {
    width: horizontal ? 72 : 24,
    height: horizontal ? 24 : 72
  })
  graph.createInstance(main.id, page.id, { name: 'Copy', x: 500 })
  // Exercise the legacy archive that needs recovery, not today's metadata writer.
  const entries = unzipSync(await exportFigFile(graph))
  entries['meta.json'] = new TextEncoder().encode('{"app":"OpenPencil"}')
  return zipSync(entries)
}

function named(graph: SceneGraph, name: string): SceneNode {
  return expectDefined([...graph.getAllNodes()].find((node) => node.name === name))
}

for (const horizontal of [false, true]) {
  test(`${horizontal ? 'horizontal' : 'vertical'}: opening old zero-padding saves releases stale content geometry`, async () => {
    let graph = await parseFigFile((await savedWithStalePadding(horizontal)).slice().buffer)
    for (let round = 0; round < 2; round++) {
      const editor = createEditor({ graph, skipInitialGraphSetup: true })
      try {
        await editor.preparePage(expectDefined(graph.getPages()[0]).id)
      } finally {
        editor.dispose()
      }
      for (const name of ['Card', 'Copy']) {
        const main = named(graph, name)
        const content = namedChild(graph, main)
        expect(main.width).toBe(horizontal ? 72 : 341)
        expect(main.height).toBe(horizontal ? 341 : 72)
        expect(content).toMatchObject({
          x: 0,
          y: 0,
          width: horizontal ? 72 : 341,
          height: horizontal ? 341 : 72
        })
      }
      graph = await parseFigFile((await exportFigFile(graph)).slice().buffer)
      expect(namedChild(graph, named(graph, 'Card'))).toMatchObject({ x: 0, y: 0 })
    }
  })
}

test('lazy page recovery also releases old padding offsets', async () => {
  const graph = await parseFigFile((await savedWithStalePadding()).slice().buffer, {
    populate: 'none'
  })
  const page = expectDefined(graph.getPages()[0])
  expect(populateFigPage(graph, page.id)).toBe(true)
  computeAllLayouts(graph)
  expect(named(graph, 'Card').height).toBe(72)
  expect(namedChild(graph, named(graph, 'Card'))).toMatchObject({ x: 0, y: 0, width: 341 })
})

function namedChild(graph: SceneGraph, parent: SceneNode): SceneNode {
  return expectDefined(graph.getChildren(parent.id).find((node) => node.name === 'Content'))
}

test('ordinary Figma archives retain saved layout geometry', async () => {
  const entries = unzipSync(await savedWithStalePadding())
  entries['meta.json'] = new TextEncoder().encode('{"app":"Figma"}')
  const graph = await parseFigFile(zipSync(entries).slice().buffer)
  computeAllLayouts(graph)
  expect(namedChild(graph, named(graph, 'Card'))).toMatchObject({ x: 24, y: 16 })
})

test.each([
  { primaryAxisAlign: 'CENTER' },
  { layoutWrap: 'WRAP' },
  { strokesIncludedInLayout: true },
  { layoutDirection: 'RTL', layoutMode: 'HORIZONTAL' }
] satisfies Partial<SceneNode>[])('preserves offsets with non-start flow geometry: %j', (props) => {
  const graph = new SceneGraph()
  const page = expectDefined(graph.getPages()[0])
  const frame = graph.createNode('FRAME', page.id, {
    layoutMode: 'VERTICAL',
    ...props,
    derivedLayout: { width: 100, height: 100 }
  })
  graph.createNode('FRAME', frame.id, { x: 24, y: 16 })
  releaseStaleSavedLayouts(graph, '{"app":"OpenPencil"}')
  expect(frame.derivedLayout).toEqual({ width: 100, height: 100 })
})
