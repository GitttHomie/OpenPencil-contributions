import { describe, expect, test } from 'bun:test'

import { SceneGraph } from '@open-pencil/scene-graph'

import { expectDefined } from '../helpers/assert'
import { pageId, rect } from './helpers'

describe('hitTest', () => {
  test('hits a rectangle', () => {
    const graph = new SceneGraph()
    const id = rect(graph, 'R', 10, 10, 50, 50)
    expect(graph.hitTest(35, 35, pageId(graph))?.id).toBe(id)
  })

  test('misses empty space', () => {
    const graph = new SceneGraph()
    rect(graph, 'R', 10, 10, 50, 50)
    expect(graph.hitTest(200, 200, pageId(graph))).toBeNull()
  })

  test('frame without fills is click-through', () => {
    const graph = new SceneGraph()
    graph.createNode('FRAME', pageId(graph), {
      name: 'Empty Frame',
      x: 0,
      y: 0,
      width: 200,
      height: 200,
      fills: []
    })
    expect(graph.hitTest(100, 100, pageId(graph))).toBeNull()
  })

  test('frame with visible fill is hittable', () => {
    const graph = new SceneGraph()
    const frame = graph.createNode('FRAME', pageId(graph), {
      name: 'Filled Frame',
      x: 0,
      y: 0,
      width: 200,
      height: 200,
      fills: [
        {
          type: 'SOLID',
          color: { r: 1, g: 0, b: 0, a: 1 },
          opacity: 1,
          visible: true,
          blendMode: 'NORMAL'
        }
      ]
    })
    expect(graph.hitTest(100, 100, pageId(graph))?.id).toBe(frame.id)
  })

  test('group returns group on hit, not child (Figma-style)', () => {
    const graph = new SceneGraph()
    const groupId = graph.createNode('GROUP', pageId(graph), {
      name: 'Group',
      x: 0,
      y: 0,
      width: 200,
      height: 200
    }).id
    graph.createNode('RECTANGLE', groupId, {
      name: 'Child',
      x: 10,
      y: 10,
      width: 30,
      height: 30
    })
    // Hit returns group (single click selects group, dblclick enters)
    expect(graph.hitTest(20, 20, pageId(graph))?.id).toBe(groupId)
    // Miss in group's empty area
    expect(graph.hitTest(201, 200, pageId(graph))).toBeNull()
  })

  test('clipsContent prevents hits outside parent bounds', () => {
    const graph = new SceneGraph()
    const frame = graph.createNode('FRAME', pageId(graph), {
      name: 'Clip Frame',
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      clipsContent: true,
      fills: []
    })
    const childId = graph.createNode('RECTANGLE', frame.id, {
      name: 'Overflow Child',
      x: 50,
      y: 50,
      width: 200,
      height: 200
    }).id
    // Inside both frame and child — hit
    expect(graph.hitTest(75, 75, pageId(graph))?.id).toBe(childId)
    // Inside child but outside clipping frame — miss
    expect(graph.hitTest(150, 150, pageId(graph))).toBeNull()
  })

  test('instance without fills is click-through in empty area', () => {
    const graph = new SceneGraph()
    const compId = graph.createNode('COMPONENT', pageId(graph), {
      name: 'Comp',
      x: 0,
      y: 0,
      width: 200,
      height: 200,
      fills: []
    }).id
    graph.createNode('RECTANGLE', compId, {
      name: 'Inner',
      x: 10,
      y: 10,
      width: 30,
      height: 30
    })
    const instId = expectDefined(
      graph.createInstance(compId, pageId(graph), { x: 300, y: 0 }),
      'instance'
    ).id
    // Hit on instance's child area — returns instance (opaque container)
    expect(graph.hitTest(320, 20, pageId(graph))?.id).toBe(instId)
    // Miss on instance's empty area (no fills)
    expect(graph.hitTest(450, 150, pageId(graph))).toBeNull()
  })

  test('hidden node is not hittable', () => {
    const graph = new SceneGraph()
    const page = pageId(graph)
    graph.createNode('RECTANGLE', page, {
      name: 'Hidden',
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      fills: [{ type: 'SOLID', color: { r: 1, g: 0, b: 0, a: 1 }, opacity: 1, visible: true }],
      visible: false
    })
    // Hidden nodes should be skipped during hit testing
    expect(graph.hitTest(50, 50, page)).toBeNull()
  })

  test('locked node IS hittable (selection behavior)', () => {
    const graph = new SceneGraph()
    const page = pageId(graph)
    const rectId = graph.createNode('RECTANGLE', page, {
      name: 'Locked',
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      fills: [{ type: 'SOLID', color: { r: 1, g: 0, b: 0, a: 1 }, opacity: 1, visible: true }],
      locked: true
    }).id
    // Locked nodes ARE returned by hit test (selection shows lock icon)
    expect(graph.hitTest(50, 50, page)?.id).toBe(rectId)
  })

  test('zero-opacity node with visible fill IS hittable', () => {
    const graph = new SceneGraph()
    const page = pageId(graph)
    const rectId = graph.createNode('RECTANGLE', page, {
      name: 'ZeroOpacity',
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      fills: [{ type: 'SOLID', color: { r: 1, g: 0, b: 0, a: 1 }, opacity: 1, visible: true }],
      opacity: 0
    }).id
    // Zero opacity does NOT affect hit testing (opacity is a visual property, not a structural one)
    // The fill is "visible: true" which is what hasVisibleFillOrStroke checks
    expect(graph.hitTest(50, 50, page)?.id).toBe(rectId)
  })
})

describe('container drop targeting', () => {
  test('uses the frontmost eligible container and excludes entire moving subtrees', () => {
    const graph = new SceneGraph()
    const back = graph.createNode('FRAME', pageId(graph), { width: 300, height: 300 })
    const front = graph.createNode('FRAME', pageId(graph), { width: 200, height: 200 })
    const nested = graph.createNode('FRAME', front.id, { width: 100, height: 100 })
    expect(graph.hitTestFrame(50, 50, new Set(), pageId(graph))?.id).toBe(nested.id)
    expect(graph.hitTestFrame(50, 50, new Set([front.id]), pageId(graph))?.id).toBe(back.id)
    graph.updateNode(front.id, { locked: true })
    expect(graph.hitTestFrame(50, 50, new Set(), pageId(graph))?.id).toBe(back.id)
  })

  test('finds visible overflowing children but respects ancestor clipping', () => {
    const graph = new SceneGraph()
    const parent = graph.createNode('FRAME', pageId(graph), { width: 100, height: 100 })
    const nested = graph.createNode('FRAME', parent.id, { x: 150, width: 100, height: 100 })
    expect(graph.hitTestFrame(200, 50, new Set(), pageId(graph))?.id).toBe(nested.id)
    graph.updateNode(parent.id, { clipsContent: true })
    expect(graph.hitTestFrame(200, 50, new Set(), pageId(graph))).toBeNull()
  })

  test('rotated frames are tested in local coordinates', () => {
    const graph = new SceneGraph()
    const frame = graph.createNode('FRAME', pageId(graph), {
      x: 100,
      y: 100,
      width: 200,
      height: 40,
      rotation: 90
    })
    expect(graph.hitTestFrame(200, 40, new Set(), pageId(graph))?.id).toBe(frame.id)
    expect(graph.hitTestFrame(120, 120, new Set(), pageId(graph))).toBeNull()
  })
})
