import * as v from 'valibot'

const probability = v.pipe(v.number(), v.minValue(0), v.maxValue(1))
const responseSchema = v.object({
  answers: v.object({
    operation: v.object({
      choice: v.picklist(['edit', 'design', 'review', 'explain']),
      probabilities: v.object({
        edit: probability,
        design: probability,
        review: probability,
        explain: probability
      })
    })
  }),
  usage: v.optional(v.object({ truncated: v.optional(v.boolean()) }))
})

// Experimental cutoff, not a claim of calibrated accuracy on design requests.
const MIN_FAST_PROBABILITY = 0.95
export function routingChoice(value: unknown): 'fast' | 'design' {
  const parsed = v.safeParse(responseSchema, value)
  if (!parsed.success || parsed.output.usage?.truncated) return 'design'
  const route = parsed.output.answers.operation
  const total = Object.values(route.probabilities).reduce((sum, value) => sum + value, 0)
  if (Math.abs(total - 1) > 0.001) return 'design'
  return route.choice === 'edit' && route.probabilities.edit >= MIN_FAST_PROBABILITY
    ? 'fast'
    : 'design'
}

export function routingRequest(text: string, selection: { type: string; name: string }[]) {
  return {
    state: { request: text, selection },
    questions: {
      operation: {
        type: 'choice',
        instructions: 'Classify the user request by the work required.',
        criteria: {
          edit: 'A precise property edit with the new value explicitly supplied: rename to X, width 100, red fill, gap 16. No creative judgment.',
          design:
            'Create something new OR improve the style, elegance, visual direction, usability, or layout. Requires creative judgment or planning.',
          review: 'Evaluate, audit, or critique a design, including accessibility.',
          explain: 'Explain concepts, answer questions, or clarify an ambiguous request.'
        }
      }
    }
  }
}
