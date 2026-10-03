import { expect, test } from 'bun:test'

import { createDesignJSXRenderer } from '@open-pencil/design-jsx'
import { SceneGraph } from '@open-pencil/scene-graph'

import { renderJSX } from '#core/design-jsx'

test('a failed component render removes its partial tree before retrying', async () => {
  const graph = new SceneGraph()
  const page = graph.getPages()[0]
  const existing = graph.createNode('FRAME', page.id, { name: 'Existing screen', x: 600 })
  const before = structuredClone([...graph.nodes])
  await expect(
    renderJSX(
      graph,
      `<Frame name="Components">
        <Component name="Button"><Text>Continue</Text></Component>
        <Component name="Navigation"><Frame><Icon name="invalid-name" /></Frame></Component>
      </Frame>`
    )
  ).rejects.toThrow('prefix:name')
  expect([...graph.nodes]).toEqual(before)
  expect(graph.getNode(existing.id)).toBe(existing)
  const [retry] = await renderJSX(
    graph,
    '<Frame name="Components"><Component name="Button"><Text>Continue</Text></Component></Frame>'
  )
  expect(page.childIds).toEqual([existing.id, retry.id])
})

test('a later fragment failure also removes earlier roots and their instance index entries', async () => {
  const graph = new SceneGraph()
  const [component] = await renderJSX(graph, '<Component name="Existing"><Rectangle /></Component>')
  await renderJSX(graph, `<Instance of="${component.id}" />`)
  const before = structuredClone([...graph.nodes])
  const index = structuredClone(graph.instanceIndex)
  await expect(
    renderJSX(graph, `<><Instance of="${component.id}" /><Frame><unsupported /></Frame></>`)
  ).rejects.toThrow('Unknown element')
  expect([...graph.nodes]).toEqual(before)
  expect(graph.instanceIndex).toEqual(index)
})

test('cleanup preserves unrelated edits made while artwork is loading', async () => {
  const graph = new SceneGraph()
  const page = graph.getPages()[0]
  const existing = graph.createNode('FRAME', page.id, { name: 'Existing' })
  let release: (() => void) | undefined
  const waiting = new Promise<void>((resolve) => {
    release = resolve
  })
  const renderer = createDesignJSXRenderer({
    icon: async () => {
      await waiting
      return null
    },
    svg: () => null,
    createArtwork: () => {
      throw new Error('No artwork should be created')
    },
    layout: () => undefined
  })
  const pending = renderer.renderJSX(
    graph,
    '<Frame name="Partial"><Icon name="test:missing" /></Frame>'
  )
  graph.updateNode(existing.id, { name: 'User edit' })
  const concurrent = graph.createNode('FRAME', page.id, { name: 'User frame' })
  release?.()
  await expect(pending).rejects.toThrow('not found')
  expect(page.childIds).toEqual([existing.id, concurrent.id])
  expect(graph.getNode(existing.id)?.name).toBe('User edit')
})
