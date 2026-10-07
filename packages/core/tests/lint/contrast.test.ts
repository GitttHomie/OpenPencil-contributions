import { describe, expect, test } from 'bun:test'

import { SceneGraph, type Color, type Fill } from '@open-pencil/scene-graph'

import { createLinter } from '#core/lint/linter'

const WHITE: Color = { r: 1, g: 1, b: 1, a: 1 }
const BLACK: Color = { r: 0, g: 0, b: 0, a: 1 }

function solid(color: Color, opacity = 1): Fill {
  return { type: 'SOLID', color, opacity, visible: true }
}

function scene() {
  const graph = new SceneGraph()
  const page = graph.getPages()[0]
  const backdrop = graph.createNode('FRAME', page.id, { fills: [solid(BLACK)] })
  const card = graph.createNode('FRAME', backdrop.id, { fills: [solid(WHITE, 0.05)] })
  const text = graph.createNode('TEXT', card.id, { text: 'Readable', fills: [solid(WHITE)] })
  const linter = createLinter({ config: { rules: { 'color-contrast': 'error' } } })
  return { graph, backdrop, card, text, lint: (ids?: string[]) => linter.lintGraph(graph, ids).messages }
}

describe('composited text contrast', () => {
  test('white text on 5% white over black passes, including selection-only lint', () => {
    const { lint, text, card } = scene()
    expect(lint()).toEqual([])
    expect(lint([card.id])).toEqual([])
    expect(lint([text.id])).toEqual([])
  })

  test('dark text on that same translucent card fails against the blended backdrop', () => {
    const { graph, lint, text } = scene()
    graph.updateNode(text.id, { fills: [solid(BLACK)] })
    expect(lint([text.id])).toMatchObject([
      { nodeId: text.id, data: { foreground: '#000000', background: '#0D0D0D', ratio: 1.07 } }
    ])
  })

  test('opaque white on white still fails', () => {
    const { graph, card, lint } = scene()
    graph.updateNode(card.id, { fills: [solid(WHITE)] })
    expect(lint()).toMatchObject([{ data: { ratio: 1 } }])
  })

  test('text opacity reduces contrast against the visible backdrop', () => {
    const { graph, text, lint } = scene()
    graph.updateNode(text.id, { fills: [solid(WHITE, 0.05)] })
    expect(lint()).toHaveLength(1)
    graph.updateNode(text.id, { fills: [solid(WHITE)], opacity: 0.05 })
    expect(lint()).toHaveLength(1)
  })

  test('respects color alpha and combines multiple fills in paint order', () => {
    const { graph, card, text, lint } = scene()
    graph.updateNode(card.id, { fills: [solid(BLACK), solid({ ...WHITE, a: 0.05 })] })
    expect(lint()).toEqual([])
    graph.updateNode(text.id, { fills: [solid(BLACK)] })
    expect(lint()).toMatchObject([{ data: { background: '#0D0D0D' } }])
  })

  test('group opacity composites text and card together over the ancestor', () => {
    const { graph, card, text, lint } = scene()
    graph.updateNode(card.id, { fills: [solid(WHITE)], opacity: 0.05 })
    graph.updateNode(text.id, { fills: [solid(BLACK)] })
    expect(lint()).toMatchObject([
      { data: { foreground: '#000000', background: '#0D0D0D', ratio: 1.07 } }
    ])
  })

  test('does not invent a background for images or gradients', () => {
    const { graph, card, lint } = scene()
    for (const type of ['IMAGE', 'GRADIENT_LINEAR'] as const) {
      graph.updateNode(card.id, { fills: [{ ...solid(WHITE), type }] })
      expect(lint()).toEqual([])
      graph.updateNode(card.id, { fills: [{ ...solid(WHITE), type }, solid(WHITE)] })
      expect(lint()).toMatchObject([{ data: { ratio: 1 } }])
    }
  })

  test('ignores invisible ancestry and unsupported blends', () => {
    const { graph, card, backdrop, lint } = scene()
    graph.updateNode(card.id, { fills: [solid(WHITE)] })
    graph.updateNode(backdrop.id, { visible: false })
    expect(lint()).toEqual([])
    graph.updateNode(backdrop.id, { visible: true, opacity: 0 })
    expect(lint()).toEqual([])
    graph.updateNode(backdrop.id, { opacity: 1, blendMode: 'MULTIPLY' })
    expect(lint()).toEqual([])
  })

  test('captures background ancestors without linting text outside the selection', () => {
    const { graph, card, text, lint } = scene()
    graph.createNode('TEXT', card.id, { text: 'Unreadable', fills: [solid(BLACK)] })
    expect(lint([text.id])).toEqual([])
    expect(lint()).toHaveLength(1)
  })
})
