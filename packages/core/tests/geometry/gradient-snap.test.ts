import { expect, test } from 'bun:test'

import { snapGradientPoint } from '#core/geometry'

test('all corners, edge midpoints and the center snap exactly in a non-square object', () => {
  for (const x of [0, 150, 300]) {
    for (const y of [0, 100, 200]) {
      const result = snapGradientPoint({ x: x + 3, y: y - 2 }, null, 300, 200)
      expect(result.position).toEqual({ x, y })
      expect(result.guides).toHaveLength(2)
    }
  }
})

test('endpoints snap across opposite edges and along the same edge', () => {
  for (const [origin, target] of [
    [
      { x: 0, y: 0 },
      { x: 300, y: 200 }
    ],
    [
      { x: 300, y: 0 },
      { x: 0, y: 200 }
    ],
    [
      { x: 0, y: 0 },
      { x: 0, y: 200 }
    ],
    [
      { x: 0, y: 200 },
      { x: 300, y: 200 }
    ],
    [
      { x: 150, y: 0 },
      { x: 150, y: 200 }
    ],
    [
      { x: 0, y: 100 },
      { x: 300, y: 100 }
    ]
  ]) {
    expect(
      snapGradientPoint({ x: target.x - 2, y: target.y + 3 }, origin, 300, 200).position
    ).toEqual(target)
  }
})

test('horizontal, vertical, 45-degree and object diagonal alignment attracts nearby drags', () => {
  const origin = { x: 37, y: 31 }
  const horizontal = snapGradientPoint({ x: 240, y: 34 }, origin, 300, 200)
  expect(horizontal.position.y).toBeCloseTo(origin.y)
  const vertical = snapGradientPoint({ x: 39, y: 170 }, origin, 300, 200)
  expect(vertical.position.x).toBeCloseTo(origin.x)
  const diagonal = snapGradientPoint({ x: 238, y: 230 }, origin, 300, 200)
  expect(diagonal.position.x - origin.x).toBeCloseTo(200)
  expect(diagonal.position.y - origin.y).toBeCloseTo(200)
  const frameDiagonal = snapGradientPoint({ x: 180, y: 122 }, { x: 0, y: 0 }, 300, 200)
  expect(frameDiagonal.position.y / frameDiagonal.position.x).toBeCloseTo(2 / 3)
})

test('snap tolerance stays constant on screen; Alt bypass and Shift angle constraints work', () => {
  const near = { x: 2, y: 73 }
  expect(snapGradientPoint(near, null, 300, 200, { zoom: 2 }).position.x).toBe(0)
  expect(snapGradientPoint(near, null, 300, 200, { zoom: 4 }).position.x).toBe(2)
  expect(snapGradientPoint(near, null, 300, 200, { disabled: true })).toEqual({
    position: near,
    guides: []
  })
  const constrained = snapGradientPoint({ x: 110, y: 73 }, { x: 0, y: 0 }, 300, 200, {
    constrain: true
  })
  expect(Math.atan2(constrained.position.y, constrained.position.x)).toBeCloseTo(Math.PI / 6)
})
