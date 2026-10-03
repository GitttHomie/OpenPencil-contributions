import { expect, test } from 'bun:test'

import { gradientHandles, moveGradientHandle } from '#core/geometry'

const identity = { m00: 1, m01: 0, m02: 0, m10: 0, m11: 1, m12: 0 }

test('linear endpoint editing preserves the opposite endpoint in a non-square frame', () => {
  const moved = moveGradientHandle('GRADIENT_LINEAR', identity, 200, 100, 'start', { x: 50, y: 80 })
  const handles = gradientHandles('GRADIENT_LINEAR', moved, 200, 100)
  expect(handles.start).toEqual({ x: 50, y: 80 })
  expect(handles.end).toEqual({ x: 0, y: 0 })
  const translated = moveGradientHandle('GRADIENT_LINEAR', moved, 200, 100, 'center', {
    x: 75,
    y: 60
  })
  const next = gradientHandles('GRADIENT_LINEAR', translated, 200, 100)
  expect(next.start).toEqual({ x: 100, y: 100 })
  expect(next.end).toEqual({ x: 50, y: 20 })
})

for (const type of ['GRADIENT_RADIAL', 'GRADIENT_ANGULAR', 'GRADIENT_DIAMOND'] as const) {
  test(`${type} rotates both axes around a fixed center and resizes the secondary radius`, () => {
    const moved = moveGradientHandle(type, identity, 200, 100, 'radius-x', { x: 100, y: 150 })
    const handles = gradientHandles(type, moved, 200, 100)
    expect(handles.center.x).toBeCloseTo(100)
    expect(handles.center.y).toBeCloseTo(50)
    expect(handles.end.x).toBeCloseTo(100)
    expect(handles.end.y).toBeCloseTo(150)
    expect(handles.radiusY?.x).toBeCloseTo(50)
    expect(handles.radiusY?.y).toBeCloseTo(50)
    const resized = moveGradientHandle(type, moved, 200, 100, 'radius-y', { x: 25, y: 50 })
    expect(gradientHandles(type, resized, 200, 100).radiusY?.x).toBeCloseTo(25)
    expect(moveGradientHandle(type, moved, 200, 100, 'radius-y', { x: 100, y: 50 })).toEqual(moved)
  })
}

test('Shift snaps to 15 degree angles and zero-size targets cannot produce invalid transforms', () => {
  const moved = moveGradientHandle(
    'GRADIENT_LINEAR',
    identity,
    200,
    100,
    'start',
    { x: 80, y: 50 },
    true
  )
  const { start } = gradientHandles('GRADIENT_LINEAR', moved, 200, 100)
  expect(Math.atan2(start.y, start.x)).toBeCloseTo(Math.PI / 6)
  expect(moveGradientHandle('GRADIENT_RADIAL', identity, 0, 100, 'center', { x: 2, y: 5 })).toEqual(
    identity
  )
})

test('vertical endpoint alignment retains an invertible gradient transform', () => {
  const moved = moveGradientHandle('GRADIENT_LINEAR', identity, 200, 100, 'start', { x: 0, y: 100 })
  expect(gradientHandles('GRADIENT_LINEAR', moved, 200, 100).start).toEqual({ x: 0, y: 100 })
  expect(Math.abs(moved.m00 * moved.m11 - moved.m01 * moved.m10)).toBeGreaterThan(0)
})
