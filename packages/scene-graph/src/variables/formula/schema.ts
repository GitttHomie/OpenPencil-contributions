import * as v from 'valibot'

import {
  VARIABLE_FORMULA_OPERATORS,
  type VariableFormulaNode
} from '@open-pencil/scene-graph/types'

import { MAX_FORMULA_DEPTH, formulaArity } from './evaluate'

const literal = v.union([
  v.pipe(v.number(), v.finite()),
  v.boolean(),
  v.object({ aliasId: v.string() })
])

/** A bounded recursive schema rejects excessively deep data before traversing it. */
function nodeSchema(depth: number): v.GenericSchema<unknown, VariableFormulaNode> {
  if (depth === 0) return literal
  return v.union([
    literal,
    v.pipe(
      v.object({
        operator: v.picklist(VARIABLE_FORMULA_OPERATORS),
        operands: v.pipe(v.array(nodeSchema(depth - 1)), v.minLength(1), v.maxLength(2))
      }),
      v.check(
        (node) => node.operands.length === formulaArity(node.operator),
        'Wrong number of operands'
      )
    )
  ])
}

export const variableFormulaSchema = v.object({
  expression: v.literal('FORMULA'),
  type: v.picklist(['FLOAT', 'BOOLEAN']),
  value: nodeSchema(MAX_FORMULA_DEPTH)
})
