import { expect, test } from 'bun:test'

import { SceneGraph } from '@open-pencil/scene-graph'

import { computeAllLayouts } from '#core/layout'

for (const layoutMode of ['HORIZONTAL', 'VERTICAL'] as const) {
  test(`${layoutMode}: an excluded top-right badge preserves its fractional overhang as Hug grows and shrinks`, () => {
    const graph = new SceneGraph()
    const frame = graph.createNode('FRAME', graph.getPages()[0].id, {
      layoutMode,
      primaryAxisSizing: 'HUG',
      counterAxisSizing: 'HUG',
      paddingLeft: 16,
      paddingRight: 16,
      paddingTop: 12,
      paddingBottom: 12
    })
    const content = graph.createNode('RECTANGLE', frame.id, { width: 60, height: 24 })
    computeAllLayouts(graph)
    const badge = graph.createNode('FRAME', frame.id, {
      x: frame.width - 15.5,
      y: -8.5,
      width: 24,
      height: 24,
      layoutPositioning: 'ABSOLUTE',
      horizontalConstraint: 'MAX',
      verticalConstraint: 'MIN'
    })
    for (const width of [151.25, 20.125, 60]) {
      graph.updateNode(content.id, { width })
      computeAllLayouts(graph)
      expect(frame.width).toBeCloseTo(width + 32)
      expect(badge.x + badge.width - frame.width).toBeCloseTo(8.5)
      expect(badge.y).toBe(-8.5)
      const position = badge.x
      computeAllLayouts(graph)
      expect(badge.x).toBe(position)
    }
  })
}

test('a Fill frame carries its excluded badge when an outer layout changes its width', () => {
  const graph = new SceneGraph()
  const outer = graph.createNode('FRAME', graph.getPages()[0].id, {
    layoutMode: 'HORIZONTAL',
    width: 200,
    height: 60,
    primaryAxisSizing: 'FIXED',
    counterAxisSizing: 'FIXED'
  })
  const inner = graph.createNode('FRAME', outer.id, {
    layoutMode: 'HORIZONTAL',
    height: 40,
    layoutGrow: 1,
    primaryAxisSizing: 'FIXED',
    counterAxisSizing: 'FIXED'
  })
  computeAllLayouts(graph)
  const badge = graph.createNode('FRAME', inner.id, {
    x: inner.width - 12,
    y: -8,
    width: 20,
    height: 20,
    layoutPositioning: 'ABSOLUTE',
    horizontalConstraint: 'MAX'
  })
  for (const width of [400, 150, 200]) {
    graph.updateNode(outer.id, { width })
    computeAllLayouts(graph)
    expect(inner.width).toBe(width)
    expect(badge.x + badge.width - inner.width).toBe(8)
  }
})

test('stretching an excluded frame applies constraints to its own children', () => {
  const graph = new SceneGraph()
  const frame = graph.createNode('FRAME', graph.getPages()[0].id, {
    layoutMode: 'HORIZONTAL',
    primaryAxisSizing: 'HUG',
    counterAxisSizing: 'HUG'
  })
  const content = graph.createNode('RECTANGLE', frame.id, { width: 100, height: 30 })
  computeAllLayouts(graph)
  const overlay = graph.createNode('FRAME', frame.id, {
    x: -4,
    y: -4,
    width: 108,
    height: 38,
    layoutPositioning: 'ABSOLUTE',
    horizontalConstraint: 'STRETCH',
    verticalConstraint: 'STRETCH'
  })
  const indicator = graph.createNode('RECTANGLE', overlay.id, {
    x: 90,
    y: 20,
    width: 10,
    height: 10,
    horizontalConstraint: 'MAX',
    verticalConstraint: 'MAX'
  })
  graph.updateNode(content.id, { width: 160, height: 50 })
  computeAllLayouts(graph)
  expect([overlay.x, overlay.y, overlay.width, overlay.height]).toEqual([-4, -4, 168, 58])
  expect([indicator.x, indicator.y]).toEqual([150, 40])
})

test('a stretched excluded frame recomputes its own auto layout', () => {
  const graph = new SceneGraph()
  const frame = graph.createNode('FRAME', graph.getPages()[0].id, {
    layoutMode: 'HORIZONTAL',
    primaryAxisSizing: 'HUG',
    counterAxisSizing: 'HUG'
  })
  const content = graph.createNode('RECTANGLE', frame.id, { width: 80, height: 30 })
  computeAllLayouts(graph)
  const overlay = graph.createNode('FRAME', frame.id, {
    x: -10,
    width: 100,
    height: 30,
    layoutPositioning: 'ABSOLUTE',
    horizontalConstraint: 'STRETCH',
    layoutMode: 'HORIZONTAL',
    primaryAxisSizing: 'FIXED',
    counterAxisSizing: 'FIXED'
  })
  const child = graph.createNode('RECTANGLE', overlay.id, {
    height: 20,
    layoutGrow: 1
  })
  computeAllLayouts(graph)
  expect(child.width).toBe(100)
  graph.updateNode(content.id, { width: 160 })
  computeAllLayouts(graph)
  expect(overlay.width).toBe(180)
  expect(child.width).toBe(180)
})
