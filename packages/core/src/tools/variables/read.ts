import * as v from 'valibot'

import type { Variable } from '@open-pencil/scene-graph'

import { withBatch } from '#core/tools/batch/define'
import { defineTool } from '#core/tools/schema'

const compactInput = v.optional(
  v.pipe(v.boolean(), v.description('Return IDs, names, types, collections and mode values only')),
  false
)

function summarize(variable: Variable) {
  const { id, name, type, collectionId, valuesByMode, unit } = variable
  return { id, name, type, collectionId, valuesByMode, ...(unit ? { unit } : {}) }
}

export const listVariables = defineTool({
  name: 'list_variables',
  description: 'List all design variables (colors, numbers, strings, booleans).',
  execution: { kind: 'sync', mutation: 'none' },
  input: v.strictObject({
    type: v.optional(
      v.pipe(
        v.picklist(['COLOR', 'FLOAT', 'STRING', 'BOOLEAN']),
        v.description('Filter by variable type')
      )
    ),
    compact: compactInput
  }),
  execute: (figma, args) => {
    const variables = figma.getLocalVariables(args.type)
    return {
      count: variables.length,
      variables: args.compact ? variables.map(summarize) : variables
    }
  }
})

export const getVariable = withBatch(
  defineTool({
    name: 'get_variable',
    description: 'Get a variable by ID.',
    execution: { kind: 'sync', mutation: 'none' },
    input: v.strictObject({
      id: v.pipe(v.string(), v.description('Variable ID'))
    }),
    execute: (figma, { id }) => {
      const variable = figma.getVariableById(id)
      if (!variable) return { error: `Variable "${id}" not found` }
      return variable
    }
  }),
  { target: 'id' }
)

export const findVariables = defineTool({
  name: 'find_variables',
  description: 'Find variables by name pattern.',
  execution: { kind: 'sync', mutation: 'none' },
  input: v.strictObject({
    query: v.pipe(v.string(), v.description('Name substring (case-insensitive)')),
    type: v.optional(
      v.pipe(v.picklist(['COLOR', 'FLOAT', 'STRING', 'BOOLEAN']), v.description('Filter by type'))
    ),
    compact: compactInput
  }),
  execute: (figma, args) => {
    let variables = figma.getLocalVariables(args.type)
    variables = variables.filter((variable) =>
      variable.name.toLowerCase().includes(args.query.toLowerCase())
    )
    return {
      count: variables.length,
      variables: args.compact ? variables.map(summarize) : variables
    }
  }
})
