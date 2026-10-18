import type { VariableFormulaNode, VariableFormulaOperator } from '@open-pencil/scene-graph'

import { formulaArity, formulaSymbol, MAX_FORMULA_DEPTH } from './evaluate'
import { FORMULA_NON_ASSOCIATIVE, FORMULA_PRECEDENCE, FORMULA_PREFIX_PRECEDENCE } from './parse'

const ATOM = FORMULA_PREFIX_PRECEDENCE + 1
/** Grouping these differently gives the same value, so `a + (b + c)` prints as `a + b + c`. */
const ASSOCIATIVE = new Set<VariableFormulaOperator>(['ADDITION', 'MULTIPLY', 'AND', 'OR'])

interface Printed {
  text: string
  precedence: number
}

/** Print a formula with only the parentheses its precedence needs; `reference` spells a variable. */
export function printFormula(node: VariableFormulaNode, reference: (id: string) => string): string {
  const print = (node: VariableFormulaNode, depth: number): Printed => {
    if (depth > MAX_FORMULA_DEPTH) return { text: '…', precedence: ATOM }
    if (typeof node === 'number')
      return { text: String(node), precedence: node < 0 ? FORMULA_PREFIX_PRECEDENCE : ATOM }
    if (typeof node === 'boolean') return { text: String(node), precedence: ATOM }
    if ('aliasId' in node) return { text: reference(node.aliasId), precedence: ATOM }
    const operands = node.operands.map((operand) => print(operand, depth + 1))
    const symbol = formulaSymbol(node.operator)
    const group = ({ text }: Printed) => `(${text})`
    if (formulaArity(node.operator) === 1) {
      const [operand] = operands
      const text = operand.precedence < ATOM ? group(operand) : operand.text
      return {
        text: node.operator === 'NOT' ? `${symbol} ${text}` : `${symbol}${text}`,
        precedence: FORMULA_PREFIX_PRECEDENCE
      }
    }
    const precedence = FORMULA_PRECEDENCE[node.operator] ?? 0
    const chained = FORMULA_NON_ASSOCIATIVE.has(precedence)
    const [left, right] = operands
    const rightNode = node.operands[1]
    const sameAssociative =
      ASSOCIATIVE.has(node.operator) &&
      typeof rightNode === 'object' &&
      'operator' in rightNode &&
      rightNode.operator === node.operator
    // A comparison inside another, such as `(a > 1) == b`, keeps its parentheses to read clearly.
    const nested = (operand: Printed) => chained && FORMULA_NON_ASSOCIATIVE.has(operand.precedence)
    const leftText = left.precedence < precedence || nested(left) ? group(left) : left.text
    const rightText =
      right.precedence < precedence ||
      nested(right) ||
      (right.precedence === precedence && !sameAssociative)
        ? group(right)
        : right.text
    return { text: `${leftText} ${symbol} ${rightText}`, precedence }
  }
  return print(node, 0).text
}
