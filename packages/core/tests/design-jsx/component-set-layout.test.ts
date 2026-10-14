import { expect, test } from 'bun:test'

import { getNodeOrThrow } from '#core-tests/helpers/assert'

import { renderJSX } from '@open-pencil/core/design-jsx'
import { SceneGraph } from '@open-pencil/scene-graph'

for (const element of ['ComponentSet', 'Button.Root']) {
  test(`${element} measures its variants before placing neighbouring definitions`, async () => {
    const graph = new SceneGraph()
    const [result] = await renderJSX(
      graph,
      `<Frame flex="row" gap={24} w="hug" h="hug">
        <${element} name="Button">
          <Component name="State=Default" w={342} h={56} />
          <Component name="State=Pressed" w={342} h={72} />
        </${element}>
        <Component name="Trait" w={120} h={30} />
      </Frame>`
    )
    const [set, neighbour] = graph.getChildren(result.id)
    const [first, second] = graph.getChildren(set.id)
    expect(set).toMatchObject({
      layoutMode: 'HORIZONTAL',
      primaryAxisSizing: 'HUG',
      counterAxisSizing: 'HUG'
    })
    expect(second.x).toBeGreaterThanOrEqual(first.x + first.width + set.itemSpacing)
    expect(set.width).toBeGreaterThanOrEqual(second.x + second.width + set.paddingRight)
    expect(set.height).toBeGreaterThanOrEqual(second.y + second.height + set.paddingBottom)
    expect(neighbour.x).toBe(set.x + set.width + 24)
    const instance = graph.createInstance(first.id, graph.getPages()[0].id)
    expect(instance).toMatchObject({ width: 342, height: 56, componentId: first.id })
  })
}

test('component sets retain explicit layout, dimensions and spacing', async () => {
  const graph = new SceneGraph()
  const [result] = await renderJSX(
    graph,
    `<ComponentSet flex="col" gap={7} p={3} w={500}>
      <Component name="State=A" w={120} h={30} />
      <Component name="State=B" w={120} h={40} />
    </ComponentSet>`
  )
  const set = getNodeOrThrow(graph, result.id)
  const [first, second] = graph.getChildren(set.id)
  expect(set).toMatchObject({ layoutMode: 'VERTICAL', width: 500, itemSpacing: 7 })
  expect(second.y).toBe(first.y + first.height + 7)
})

test('manually positioned variants keep their authored positions', async () => {
  const graph = new SceneGraph()
  const [result] = await renderJSX(
    graph,
    `<ComponentSet w={500} h={200}>
      <Component name="State=A" x={10} y={20} w={120} h={30} />
      <Component name="State=B" x={180} y={90} w={120} h={40} />
    </ComponentSet>`
  )
  expect(getNodeOrThrow(graph, result.id).layoutMode).toBe('NONE')
  const [first, second] = graph.getChildren(result.id)
  expect(first).toMatchObject({ x: 10, y: 20 })
  expect(second).toMatchObject({ x: 180, y: 90 })
})
