import { expect, test } from 'bun:test'

import { getNodeOrThrow } from '#core-tests/helpers/assert'

import { createElement, buildComponent, resolveToTree } from '@open-pencil/design-jsx'
import { SceneGraph } from '@open-pencil/scene-graph'

import { FigmaAPI } from '#core/figma-api'
import { render, renderDesignTree } from '#core/tools/create/render'
import { designFeedback } from '#core/tools/design-guidance/feedback'

test('MCP tree renders report real spacing, definition, and placement problems', async () => {
  const graph = new SceneGraph()
  const page = graph.getPages()[0]
  const old = graph.createNode('COMPONENT', page.id, {
    name: 'Button',
    width: 100,
    height: 100
  })
  const tree = resolveToTree(
    createElement(
      buildComponent(
        `<Frame name="Components" w={400} h="hug" flex="col" p={24}>
      <Component name="Button" w={200} h="hug" flex="row" p={24}>
        <Rectangle w={20} h={20} />
      </Component>
    </Frame>`
      ),
      null
    )
  )
  if (!tree) throw new Error('Expected a tree')
  const result = await renderDesignTree(new FigmaAPI(graph), tree, {})
  expect(result.designFeedback?.map((finding) => finding.code)).toEqual([
    'unbound-spacing',
    'component-name-collision',
    'canvas-overlap'
  ])
  const collision = result.designFeedback?.find(
    (finding) => finding.code === 'component-name-collision'
  )
  expect(collision?.nodeIds).toContain(old.id)
  expect(graph.getNode(old.id)).toBe(old)
})

test('bound spacing and linked instances do not trigger raw-spacing or duplicate-definition feedback', async () => {
  const graph = new SceneGraph()
  const figma = new FigmaAPI(graph)
  const collection = figma.createVariableCollection('Layout')
  const space = figma.createVariable('Space/control', 'FLOAT', collection.id, 12)
  const tree = resolveToTree(
    createElement(
      buildComponent(
        `<Frame flex="col" w={300} h="hug" p={designVar('${space.id}')}>
      <Component name="Button" flex="row" w={100} h="hug" p={designVar('${space.id}')}>
        <Rectangle w={20} h={20} />
      </Component>
    </Frame>`
      ),
      null
    )
  )
  if (!tree) throw new Error('Expected a tree')
  const result = await renderDesignTree(figma, tree, {})
  expect(result.designFeedback).toBeUndefined()
  const componentId = getNodeOrThrow(graph, result.id).childIds[0]
  const instance = graph.createInstance(componentId, graph.getPages()[0].id, { x: 500 })
  if (!instance) throw new Error('Expected an instance')
  expect(designFeedback(graph, [instance.id])).toEqual([])
})

test('four sides of one container are not treated as a repeated spacing role', () => {
  const graph = new SceneGraph()
  const frame = graph.createNode('FRAME', graph.getPages()[0].id, {
    layoutMode: 'VERTICAL',
    paddingTop: 24,
    paddingRight: 24,
    paddingBottom: 24,
    paddingLeft: 24
  })
  expect(designFeedback(graph, [frame.id])).toEqual([])
})

test('MCP tree replacement preserves placement, removes the old node, and reports every fragment root', async () => {
  const graph = new SceneGraph()
  const figma = new FigmaAPI(graph)
  const old = graph.createNode('FRAME', graph.getPages()[0].id, { x: 800, y: 200 })
  const tree = resolveToTree(
    createElement(
      buildComponent('<><Frame name="A" w={200} h={100} /><Frame name="B" w={100} h={100} /></>'),
      null
    )
  )
  if (!tree) throw new Error('Expected a tree')
  const result = await renderDesignTree(figma, tree, { replace_id: old.id })
  expect(graph.getNode(old.id)).toBeUndefined()
  expect(graph.getNode(result.id)).toMatchObject({ x: 800, y: 200 })
  expect(result.siblings).toHaveLength(1)
  expect(result.designFeedback?.every((finding) => !finding.nodeIds.includes(old.id))).toBe(true)
})

test('direct JSX renders expose the same spacing feedback as MCP tree renders', async () => {
  const graph = new SceneGraph()
  const result = await render.execute(new FigmaAPI(graph), {
    jsx: '<Frame flex="col" p={16}><Frame flex="col" p={16}><Rectangle /></Frame></Frame>'
  })
  expect(result).toMatchObject({
    designFeedback: [{ code: 'unbound-spacing', nodeIds: expect.any(Array) }]
  })
})

test('nested component sets report overlapping variants and overflowing definitions', () => {
  const graph = new SceneGraph()
  const page = graph.getPages()[0]
  const board = graph.createNode('FRAME', page.id, { width: 1250, height: 300 })
  const set = graph.createNode('COMPONENT_SET', board.id, { width: 100, height: 100 })
  const first = graph.createNode('COMPONENT', set.id, { name: 'Default', width: 342, height: 56 })
  const second = graph.createNode('COMPONENT', set.id, { name: 'Pressed', width: 342, height: 56 })
  const findings = designFeedback(graph, [board.id])
  expect(findings).toContainEqual(
    expect.objectContaining({ code: 'component-overlap', nodeIds: [first.id, second.id, set.id] })
  )
  expect(findings).toContainEqual(
    expect.objectContaining({ code: 'component-overflow', nodeIds: [first.id, set.id] })
  )
  graph.updateNode(set.id, { width: 744 })
  graph.updateNode(second.id, { x: 362 })
  expect(designFeedback(graph, [board.id])).toEqual([])
})

test('overlapping definitions in a nested board row are reported', () => {
  const graph = new SceneGraph()
  const board = graph.createNode('FRAME', graph.getPages()[0].id, { width: 800, height: 300 })
  const row = graph.createNode('FRAME', board.id, { width: 800, height: 100 })
  const first = graph.createNode('COMPONENT_SET', row.id, { width: 342, height: 56 })
  const second = graph.createNode('COMPONENT', row.id, { x: 124, width: 120, height: 30 })
  expect(designFeedback(graph, [board.id])).toContainEqual(
    expect.objectContaining({ code: 'component-overlap', nodeIds: [first.id, second.id, row.id] })
  )
})

test('definition checks leave decorative overlaps, badges and hidden variants alone', () => {
  const graph = new SceneGraph()
  const board = graph.createNode('FRAME', graph.getPages()[0].id, { width: 300, height: 100 })
  const component = graph.createNode('COMPONENT', board.id, { width: 100, height: 40 })
  graph.createNode('FRAME', component.id, { x: 90, y: -10, width: 30, height: 30 })
  graph.createNode('FRAME', component.id, { width: 100, height: 40 })
  graph.createNode('COMPONENT', board.id, { name: 'Hidden', visible: false, width: 500 })
  const hidden = graph.createNode('FRAME', board.id, { visible: false })
  graph.createNode('COMPONENT', hidden.id, { name: 'Hidden descendant', width: 500 })
  expect(designFeedback(graph, [board.id])).toEqual([])
})

test('definition layout feedback is bounded on large broken sets', () => {
  const graph = new SceneGraph()
  const set = graph.createNode('COMPONENT_SET', graph.getPages()[0].id)
  for (let index = 0; index < 100; index++)
    graph.createNode('COMPONENT', set.id, { name: `Variant ${index}` })
  expect(
    designFeedback(graph, [set.id]).filter((finding) => finding.code === 'component-overlap')
  ).toHaveLength(3)
})

test('a row enclosing definitions cannot hide overflow from its outer board', async () => {
  const graph = new SceneGraph()
  const result = await render.execute(new FigmaAPI(graph), {
    jsx: `<Frame name="Board" w={1250} h="hug" flex="col" p={24}>
      <Frame name="Definitions" flex="row" gap={24}>
        <ComponentSet name="Button">
          <Component name="State=Default" w={342} h={56} />
          <Component name="State=Pressed" w={342} h={56} />
        </ComponentSet>
        <Component name="Trait" w={120} h={30} />
        <Component name="Status" w={390} h={44} />
      </Frame>
    </Frame>`
  })
  expect(result).toMatchObject({
    designFeedback: expect.arrayContaining([
      expect.objectContaining({
        code: 'component-overflow',
        message: expect.stringContaining('"Definitions"')
      })
    ])
  })
})
