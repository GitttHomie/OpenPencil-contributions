import { expect, test } from 'bun:test'

import { getNodeLocalMatrix } from '#scene-graph/coordinate'
import { createDefaultNode, SceneGraph } from '#scene-graph/index'
import Matrix from '#scene-graph/matrix'
import { parseSVGPath } from '#scene-graph/parse-path'
import { computeAccurateBounds, regenerateFillGeometry } from '#scene-graph/vector'
import { fittedVectorChanges } from '#scene-graph/vector/geometry'

test('drawn geometry determines the box even when a caller supplies a viewBox-sized rectangle', () => {
  const graph = new SceneGraph()
  const path = graph.createNode('VECTOR', graph.getPages()[0].id, {
    x: 10,
    y: 20,
    width: 1004,
    height: 1004,
    vectorNetwork: parseSVGPath('M153 400 L292 400 L153 578 Z')
  })
  expect(path).toMatchObject({ x: 163, y: 420, width: 139, height: 178 })
  expect(path.vectorNetwork && computeAccurateBounds(path.vectorNetwork)).toEqual({
    x: 0,
    y: 0,
    width: 139,
    height: 178
  })
  graph.updateNode(path.id, { width: 278 })
  expect(path.width).toBe(278)
  expect(path.vectorNetwork && computeAccurateBounds(path.vectorNetwork).width).toBe(278)
  graph.updateNode(path.id, { vectorNetwork: parseSVGPath('M-5 -6 L15 -6 L15 24 Z') })
  expect(path).toMatchObject({ x: 158, y: 414, width: 20, height: 30 })
})

test('curve bounds use extrema, not the control handles', () => {
  const graph = new SceneGraph()
  const path = graph.createNode('VECTOR', graph.getPages()[0].id, {
    vectorNetwork: parseSVGPath('M0 0 C0 -50 100 50 100 0')
  })
  expect(path.y).toBeCloseTo(-14.4337567)
  expect(path.height).toBeCloseTo(28.8675134)
})

test('horizontal and vertical paths resize despite having a zero-sized axis', () => {
  for (const [data, changes, expected] of [
    ['M5 9 L19 9', { width: 28 }, { x: 5, y: 9, width: 28, height: 0 }],
    ['M9 5 L9 19', { height: 28 }, { x: 9, y: 5, width: 0, height: 28 }]
  ] as const) {
    const graph = new SceneGraph()
    const path = graph.createNode('VECTOR', graph.getPages()[0].id, {
      vectorNetwork: parseSVGPath(data),
      strokes: [
        {
          type: 'SOLID',
          color: { r: 0, g: 0, b: 0, a: 1 },
          opacity: 1,
          visible: true,
          weight: 2,
          align: 'CENTER'
        }
      ]
    })
    graph.updateNode(path.id, changes)
    expect(path).toMatchObject(expected)
    expect(path.strokes[0].weight).toBe(4)
    expect(path.vectorNetwork && computeAccurateBounds(path.vectorNetwork)).toMatchObject({
      width: expected.width,
      height: expected.height
    })
  }
})

test('rebasing preserves every vertex under rotations and reflections', () => {
  for (const rotation of [0, 37, 90, -123])
    for (const flipX of [false, true])
      for (const flipY of [false, true]) {
        const node = createDefaultNode(() => 'vector', 'VECTOR', {
          x: 40,
          y: 70,
          width: 200,
          height: 300,
          rotation,
          flipX,
          flipY,
          vectorNetwork: parseSVGPath('M20 35 L80 40 L50 90 Z')
        })
        const points = (n: typeof node) =>
          Matrix.mapPoints(
            getNodeLocalMatrix(n),
            n.vectorNetwork?.vertices.flatMap((v) => [v.x, v.y]) ?? []
          )
        const before = points(node)
        Object.assign(node, fittedVectorChanges(node))
        points(node).forEach((value, i) => expect(value).toBeCloseTo(before[i], 8))
        expect(node).toMatchObject({ width: 60, height: 55 })
      }
})

test('gradient endpoints keep their parent-space placement when a path is fitted', () => {
  const node = createDefaultNode(() => 'vector', 'VECTOR', {
    width: 100,
    height: 100,
    vectorNetwork: parseSVGPath('M20 30 H60 V80 H20 Z'),
    fills: [
      {
        type: 'GRADIENT_LINEAR',
        color: { r: 0, g: 0, b: 0, a: 1 },
        opacity: 1,
        visible: true,
        gradientTransform: { m00: 1, m01: 0, m02: 0, m10: 0, m11: 1, m12: 0 }
      }
    ]
  })
  Object.assign(node, fittedVectorChanges(node))
  const t = node.fills[0].gradientTransform
  if (!t) throw new Error('Missing gradient')
  expect(node.x + node.width * t.m02).toBe(0)
  expect(node.x + node.width * (t.m02 + t.m00)).toBe(100)
  expect(node.y + node.height * t.m12).toBe(0)
  expect(node.y + node.height * (t.m12 + t.m11)).toBe(100)
})

test('clearing the final points clears the bounds', () => {
  const graph = new SceneGraph()
  const node = graph.createNode('VECTOR', graph.getPages()[0].id, {
    vectorNetwork: parseSVGPath('M1 1 L8 9')
  })
  graph.updateNode(node.id, { vectorNetwork: { vertices: [], segments: [], regions: [] } })
  expect(node).toMatchObject({ width: 0, height: 0 })
})

test('point edits replace cached fills and strokes, while identical networks preserve baked geometry', () => {
  const graph = new SceneGraph()
  const original = parseSVGPath('M0 0 H40 V20 H0 Z')
  const geometry = regenerateFillGeometry(original, [
    { windingRule: 'NONZERO', commandsBlob: new Uint8Array() }
  ])
  const node = graph.createNode('VECTOR', graph.getPages()[0].id, {
    vectorNetwork: original,
    width: 40,
    height: 20,
    fillGeometry: geometry,
    strokeGeometry: geometry
  })
  graph.updateNode(node.id, { vectorNetwork: structuredClone(original) })
  expect(node.strokeGeometry).toEqual(geometry)
  graph.updateNode(node.id, { vectorNetwork: parseSVGPath('M10 15 H90 V45 H10 Z') })
  expect(node).toMatchObject({ x: 10, y: 15, width: 80, height: 30, strokeGeometry: [] })
  const rebuilt = regenerateFillGeometry(parseSVGPath('M0 0 H80 V30 H0 Z'), geometry)
  expect(node.fillGeometry).toEqual(rebuilt)
})

test('image crop coordinates retain their placement when vector bounds are fitted', () => {
  const node = createDefaultNode(() => 'vector', 'VECTOR', {
    width: 100,
    height: 100,
    vectorNetwork: parseSVGPath('M20 30 H60 V80 H20 Z'),
    fills: [
      {
        type: 'IMAGE',
        imageScaleMode: 'CROP',
        imageTransform: { m00: 1, m01: 0, m02: 0, m10: 0, m11: 1, m12: 0 },
        color: { r: 0, g: 0, b: 0, a: 1 },
        opacity: 1,
        visible: true
      }
    ]
  })
  Object.assign(node, fittedVectorChanges(node))
  expect(node.fills[0].imageTransform).toEqual({
    m00: 0.4,
    m01: 0,
    m02: 0.2,
    m10: 0,
    m11: 0.5,
    m12: 0.3
  })
})
