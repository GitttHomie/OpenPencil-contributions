import type { Effect, SceneGraph } from '@open-pencil/scene-graph'

const solid = (r: number, g: number, b: number, opacity = 1) => ({
  type: 'SOLID' as const,
  color: { r, g, b, a: 1 },
  opacity,
  visible: true
})

function effect(type: Effect['type'], radius: number, y = 0): Effect {
  return {
    type,
    radius,
    spread: 0,
    offset: { x: 0, y },
    color: { r: 0.06, g: 0.09, b: 0.16, a: 0.6 },
    visible: true,
    blendMode: 'NORMAL',
    showShadowBehindNode: false
  }
}

/** Layer blur, drop and inner shadow, and background blur, each at a 16px radius. */
export function createBlurEffectsScene(graph: SceneGraph, pageId: string): void {
  const card = { y: 100, width: 120, height: 120, cornerRadius: 20 }
  graph.createNode('RECTANGLE', pageId, {
    name: 'Layer blur',
    x: 80,
    ...card,
    fills: [solid(0.31, 0.27, 0.9)],
    effects: [effect('LAYER_BLUR', 16)]
  })
  graph.createNode('RECTANGLE', pageId, {
    name: 'Drop shadow',
    x: 260,
    ...card,
    fills: [solid(1, 1, 1)],
    effects: [effect('DROP_SHADOW', 16, 8)]
  })
  graph.createNode('RECTANGLE', pageId, {
    name: 'Inner shadow',
    x: 440,
    ...card,
    fills: [solid(1, 1, 1)],
    effects: [effect('INNER_SHADOW', 16, 8)]
  })
  for (const [index, color] of [
    [0.96, 0.35, 0.35],
    [0.08, 0.73, 0.73],
    [0.23, 0.51, 0.96]
  ].entries()) {
    graph.createNode('RECTANGLE', pageId, {
      name: `Stripe ${index + 1}`,
      x: 620 + index * 40,
      y: 100,
      width: 40,
      height: 120,
      fills: [solid(color[0], color[1], color[2])]
    })
  }
  graph.createNode('RECTANGLE', pageId, {
    name: 'Background blur',
    x: 640,
    y: 120,
    width: 80,
    height: 80,
    cornerRadius: 16,
    fills: [solid(1, 1, 1, 0.2)],
    effects: [effect('BACKGROUND_BLUR', 16)]
  })
}

export function createImportedEffectsScene(graph: SceneGraph, pageId: string) {
  const frame = graph.createNode('FRAME', pageId, {
    name: 'Imported menu',
    x: -1600,
    y: 3300,
    width: 600,
    height: 250,
    fills: [solid(1, 1, 1)],
    clipsContent: true
  })
  const glow = graph.createNode('ELLIPSE', frame.id, {
    name: 'Glow',
    x: 150,
    y: 80,
    width: 73,
    height: 73,
    fills: [solid(0.1, 0.55, 0.9)],
    effects: [effect('FOREGROUND_BLUR', 44)]
  })
  graph.createNode('RECTANGLE', frame.id, {
    name: 'Glass button',
    x: 170,
    y: 100,
    width: 180,
    height: 60,
    cornerRadius: 30,
    fills: [solid(1, 1, 1, 0.2)],
    effects: [effect('BACKGROUND_BLUR', 12), effect('DROP_SHADOW', 8, 4)]
  })
  const invalid = graph.createNode('BOOLEAN_OPERATION', frame.id, {
    name: 'Invalid imported union',
    x: Number.NaN,
    y: Number.NaN,
    width: Number.NaN,
    height: Number.NaN,
    rotation: Number.NaN,
    visible: false
  })
  graph.createNode('RECTANGLE', invalid.id, { width: 20, height: 20, fills: [solid(1, 0, 0)] })
  return { frameId: frame.id, glowId: glow.id, invalidId: invalid.id }
}
