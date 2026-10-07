import { expect, test } from 'bun:test'

import * as v from 'valibot'

import { ALL_TOOLS } from '@open-pencil/core/tools'

import { buildACPUserPrompt } from '@/app/ai/acp/prompt'

test('Kiro receives executable dispatcher arguments on first and later turns', () => {
  const render = ALL_TOOLS.find((tool) => tool.name === 'render')
  if (!render) throw new Error('Render tool missing')
  for (const includeReference of [true, false]) {
    const prompt = buildACPUserPrompt('Make a card', includeReference, 'kiro-cli')
    const example = prompt.match(
      /```json\n(\{[\s\S]*?"tool_id"\s*:\s*"open-pencil::render"[\s\S]*?)\n```/
    )
    if (!example) throw new Error('Kiro dispatcher example missing')
    const dispatch: unknown = JSON.parse(example[1])
    const parsed = v.parse(
      v.object({
        tool_id: v.literal('open-pencil::render'),
        arguments: render.input
      }),
      dispatch
    )
    expect(parsed.arguments).toMatchObject({
      jsx: '<Frame name="Card" w={320} h={200} />',
      x: 100,
      y: 100
    })
    expect(prompt).toContain('Make a card')
  }
})

test('other agents do not receive Kiro-specific dispatch instructions', () => {
  for (const agent of ['codex', 'claude-code', 'gemini-cli'] as const) {
    expect(buildACPUserPrompt('Make a card', false, agent)).not.toContain('## Kiro tool dispatch')
  }
})
