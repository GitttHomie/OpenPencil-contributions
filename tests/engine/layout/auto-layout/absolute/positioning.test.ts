import { describe, expect, test } from 'bun:test'

import { computeAllLayouts, computeLayout, SceneGraph } from '@open-pencil/core'
import { getTextMeasurer, setTextMeasurer } from '@open-pencil/core/layout'

import { autoFrame, pageId, rect } from '#tests/helpers/layout'

describe('absolute positioning', () => {
  for (const [constraint, factor] of [
    ['MIN', 0],
    ['CENTER', 0.5],
    ['MAX', 1]
  ] as const) {
    test(`intrinsic height changes preserve a free badge's ${constraint} anchor`, () => {
      const graph = new SceneGraph()
      const parent = graph.createNode('FRAME', pageId(graph), { width: 200, height: 100 })
      const badge = autoFrame(graph, parent.id, {
        x: 160,
        y: 80,
        width: 40,
        height: 20,
        primaryAxisSizing: 'HUG',
        counterAxisSizing: 'HUG',
        horizontalConstraint: constraint,
        verticalConstraint: constraint
      })
      const child = rect(graph, badge.id, 40, 20)
      computeLayout(graph, badge.id)
      const anchor = { x: badge.x + badge.width * factor, y: badge.y + badge.height * factor }
      graph.updateNode(child.id, { width: 70, height: 50 })
      computeLayout(graph, badge.id)
      expect(badge.x + badge.width * factor).toBeCloseTo(anchor.x)
      expect(badge.y + badge.height * factor).toBeCloseTo(anchor.y)
    })
  }
  test('constraints do not reposition children participating in their parent layout', () => {
    const graph = new SceneGraph()
    const parent = autoFrame(graph, pageId(graph), { paddingLeft: 12 })
    const badge = autoFrame(graph, parent.id, {
      width: 20,
      primaryAxisSizing: 'HUG',
      horizontalConstraint: 'MAX'
    })
    const child = rect(graph, badge.id, 20, 20)
    computeLayout(graph, parent.id)
    graph.updateNode(child.id, { width: 50 })
    computeLayout(graph, parent.id)
    expect(badge.x).toBe(12)
    expect(badge.width).toBe(50)
  })
  for (const parentHug of [false, true]) {
    test(`a Hug badge keeps its right overhang as its text and ${parentHug ? 'Hug' : 'fixed'} parent change`, () => {
      const previous = getTextMeasurer()
      setTextMeasurer((node) => ({ width: node.text.length * 8, height: 12 }))
      try {
        const graph = new SceneGraph()
        const parent = autoFrame(graph, pageId(graph), {
          width: 200,
          height: 60,
          primaryAxisSizing: parentHug ? 'HUG' : 'FIXED'
        })
        const label = rect(graph, parent.id, 100, 40)
        const badge = autoFrame(graph, parent.id, {
          x: 180,
          y: -8,
          width: 24,
          height: 20,
          layoutPositioning: 'ABSOLUTE',
          horizontalConstraint: 'MAX',
          primaryAxisSizing: 'HUG',
          counterAxisSizing: 'HUG',
          primaryAxisAlign: 'MAX',
          paddingLeft: 4,
          paddingRight: 4,
          paddingTop: 4,
          paddingBottom: 4
        })
        const number = graph.createNode('TEXT', badge.id, {
          text: '1',
          width: 8,
          height: 12,
          textAutoResize: 'WIDTH_AND_HEIGHT'
        })
        computeAllLayouts(graph)
        graph.updateNode(badge.id, { x: parent.width - badge.width + 8 })
        const smallWidth = badge.width
        for (const text of ['9999', '9', '99999', '1']) {
          graph.updateNode(number.id, { text })
          graph.updateNode(label.id, { width: text.length * 40 })
          computeAllLayouts(graph)
          expect(badge.width).toBe(text.length * 8 + 8)
          expect(badge.x + badge.width - parent.width).toBeCloseTo(8)
          expect(badge.y).toBe(-8)
          expect(number.x + number.width).toBeCloseTo(badge.width - 4)
          const before = badge.x
          computeLayout(graph, parent.id)
          expect(badge.x).toBe(before)
        }
        expect(badge.width).toBe(smallWidth)
      } finally {
        setTextMeasurer(previous)
      }
    })
  }
  test('absolute children are skipped in layout', () => {
    const graph = new SceneGraph()
    const frame = autoFrame(graph, pageId(graph), {
      width: 400,
      height: 200,
      itemSpacing: 10
    })
    rect(graph, frame.id, 50, 50)
    rect(graph, frame.id, 50, 50, {
      layoutPositioning: 'ABSOLUTE',
      x: 200,
      y: 100
    })
    rect(graph, frame.id, 50, 50)

    computeLayout(graph, frame.id)

    const children = graph.getChildren(frame.id)
    // First auto child at 0
    expect(children[0].x).toBe(0)
    // Absolute child should keep its position
    expect(children[1].x).toBe(200)
    expect(children[1].y).toBe(100)
    // Third child should be right after first (no gap for absolute)
    expect(children[2].x).toBe(60)
  })
})
