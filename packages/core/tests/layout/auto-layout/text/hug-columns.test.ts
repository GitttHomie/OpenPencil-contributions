import { afterEach, expect, test } from 'bun:test'

import { SceneGraph } from '@open-pencil/scene-graph'

import { computeAllLayouts, setTextMeasurer } from '#core/layout'

afterEach(() => setTextMeasurer(null))

test('wrapping Fill text contributes its content width to adjacent Hug columns', () => {
  setTextMeasurer((node, limit) => {
    const natural = node.text.length * 8
    const width = Math.min(natural, limit ?? Infinity)
    return { width, height: 20 * Math.max(1, Math.ceil(natural / Math.max(1, width))) }
  })
  const graph = new SceneGraph()
  const footer = graph.createNode('COMPONENT', graph.getPages()[0].id, {
    layoutMode: 'HORIZONTAL',
    width: 600,
    height: 80,
    primaryAxisSizing: 'FIXED',
    counterAxisSizing: 'HUG',
    primaryAxisAlign: 'SPACE_BETWEEN'
  })
  const columns = ['Company', 'Support', 'Products'].map((text) => {
    const column = graph.createNode('FRAME', footer.id, {
      layoutMode: 'VERTICAL',
      primaryAxisSizing: 'HUG',
      counterAxisSizing: 'HUG',
      width: 600,
      height: 20
    })
    graph.createNode('TEXT', column.id, {
      text,
      width: 600,
      height: 20,
      textAutoResize: 'HEIGHT',
      layoutAlignSelf: 'STRETCH'
    })
    return column
  })
  for (const width of [600, 360, 720, 360]) {
    graph.updateNode(footer.id, { width })
    computeAllLayouts(graph, footer.id)
    expect(columns.map((node) => node.width)).toEqual([56, 56, 64])
    expect(columns[0].x).toBe(0)
    expect(columns[2].x + columns[2].width).toBe(width)
    expect(columns[1].x).toBeGreaterThan(56)
    for (const column of columns) {
      expect(graph.getChildren(column.id)[0].width).toBe(column.width)
      expect(column.height).toBe(20)
    }
  }
  // An explicit fixed column still allocates its full width to wrapping text.
  graph.updateNode(columns[0].id, { counterAxisSizing: 'FIXED', width: 40 })
  computeAllLayouts(graph, footer.id)
  expect(columns[0].width).toBe(40)
  expect(columns[0].height).toBe(40)
  expect(graph.getChildren(columns[0].id)[0].width).toBe(40)
})
