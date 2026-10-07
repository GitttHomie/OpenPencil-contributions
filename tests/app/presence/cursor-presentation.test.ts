import { expect, test } from 'bun:test'

import type { PresenceCursor } from '@open-pencil/core/canvas'

import { canvasPresenceCursors, hasAgentPointer } from '@/app/presence/cursor-presentation'

test('only identified agents use the separate pointer layer, preserving true targets and selections', () => {
  const agent: PresenceCursor = {
    id: 'agent',
    kind: 'agent',
    name: 'Fern',
    color: { r: 1, g: 0, b: 0, a: 1 },
    x: 100,
    y: 20,
    selection: ['frame']
  }
  const person: PresenceCursor = { ...agent, id: 'person', kind: 'person' }
  const anonymous: PresenceCursor = { ...agent, id: undefined }
  const source = [agent, person, anonymous]
  const projected = canvasPresenceCursors(source)
  expect(source.filter(hasAgentPointer)).toEqual([agent])
  expect(projected[0]).toEqual({ ...agent, pointerVisible: false })
  expect(projected[1]).toBe(person)
  expect(projected[2]).toBe(anonymous)
  expect(agent.pointerVisible).toBeUndefined()
  expect(agent.selection).toEqual(['frame'])
})
