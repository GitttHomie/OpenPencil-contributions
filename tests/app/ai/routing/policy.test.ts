import { expect, test } from 'bun:test'

import { routingChoice } from '@/app/ai/routing/policy'

function result(fast: number, truncated = false) {
  return {
    answers: {
      operation: {
        choice: 'edit',
        probabilities: { edit: fast, design: 1 - fast, review: 0, explain: 0 }
      }
    },
    usage: { truncated }
  }
}

test('only a valid, untruncated high-probability fast decision can change the model', () => {
  expect(routingChoice(result(0.99))).toBe('fast')
  for (const value of [
    result(0.8),
    result(0.99, true),
    result(Number.NaN),
    null,
    {},
    {
      answers: {
        operation: {
          choice: 'edit',
          probabilities: { edit: 0.99, design: 0.99, review: 0, explain: 0 }
        }
      }
    }
  ])
    expect(routingChoice(value)).toBe('design')
})

test('a confident review stays on Design and an uncertain edit does not become a fast task', () => {
  expect(
    routingChoice({
      answers: {
        operation: {
          choice: 'review',
          probabilities: { edit: 0.001, design: 0.008, review: 0.99, explain: 0.001 }
        }
      }
    })
  ).toBe('design')
  expect(routingChoice(result(0.8702))).toBe('design')
})
