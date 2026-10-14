import type {
  SceneGraph,
  VariableFormulaNode,
  VariableLiteral,
  VariableValue
} from '@open-pencil/scene-graph'

import { variableValueInMode } from '../resolution'
import { variableValueReferences, resolveVariableValue } from '../value'
import { evaluateVariableFormula, MAX_FORMULA_DEPTH, VariableFormulaError } from './evaluate'
import { parseFormulaSyntax } from './parse'

export {
  evaluateVariableFormula,
  formulaArity,
  formulaOperandType,
  MAX_FORMULA_DEPTH
} from './evaluate'

const SYMBOLS = {
  ADDITION: '+',
  SUBTRACTION: '-',
  MULTIPLY: '*',
  DIVIDE: '/',
  AND: 'AND',
  OR: 'OR',
  NOT_EQUAL: 'XOR',
  NEGATE: '-',
  NOT: 'NOT '
} as const

/** Qualified names disambiguate references; the stored formula uses stable IDs. */
export function variableFormulaReference(graph: SceneGraph, id: string): string {
  const variable = graph.variables.get(id)
  if (!variable) return `{#${id}}`
  const collection = graph.variableCollections.get(variable.collectionId)
  const name = `${collection?.name ?? variable.collectionId}::${variable.name}`
  const matches = [...graph.variables.values()].filter(
    (item) =>
      `${graph.variableCollections.get(item.collectionId)?.name ?? item.collectionId}::${item.name}` ===
      name
  )
  return /[{}]/.test(name) || name.trim() !== name || matches.length !== 1
    ? `{#${id}}`
    : `{${name}}`
}

export function formatVariableFormula(graph: SceneGraph, value: VariableValue): string {
  const format = (node: VariableFormulaNode, depth = 0): string => {
    if (depth > MAX_FORMULA_DEPTH) return '…'
    if (typeof node !== 'object') return String(node)
    if ('aliasId' in node) return variableFormulaReference(graph, node.aliasId)
    const args = node.operands.map((operand) => format(operand, depth + 1))
    const symbol = SYMBOLS[node.operator]
    return args.length === 1 ? `${symbol}(${args[0]})` : `(${args.join(` ${symbol} `)})`
  }
  if (typeof value === 'object' && 'expression' in value && value.expression === 'FORMULA')
    return format(value.value)
  if (
    typeof value === 'number' ||
    typeof value === 'boolean' ||
    (typeof value === 'object' && 'aliasId' in value)
  )
    return format(value)
  return ''
}

/** Validate a draft without changing the document. Formulas operate on stored units. */
export function parseVariableFormula(
  graph: SceneGraph,
  variableId: string,
  modeId: string,
  source: string
): { value: VariableValue; resolved: number | boolean } {
  const variable = graph.variables.get(variableId)
  if (!variable || !['FLOAT', 'BOOLEAN'].includes(variable.type))
    throw new VariableFormulaError('Select a number or Boolean variable')
  const collection = graph.variableCollections.get(variable.collectionId)
  if (!collection?.modes.some((mode) => mode.modeId === modeId))
    throw new VariableFormulaError('Unknown variable mode')
  const tree = parseFormulaSyntax(source, (name) => {
    const candidates = [...graph.variables.values()].filter(
      (candidate) =>
        name === `#${candidate.id}` ||
        name ===
          `${graph.variableCollections.get(candidate.collectionId)?.name}::${candidate.name}` ||
        name === candidate.name
    )
    const local = candidates.filter((candidate) => candidate.collectionId === variable.collectionId)
    const matches = local.length === 1 ? local : candidates
    const match = matches.at(0)
    if (!match || matches.length !== 1)
      throw new VariableFormulaError(
        matches.length ? `Ambiguous variable: ${name}` : `Unknown variable: ${name}`
      )
    if (match.type !== variable.type)
      throw new VariableFormulaError(`Incompatible variable type: ${name}`)
    return match.id
  })
  const type = variable.type === 'FLOAT' ? 'FLOAT' : 'BOOLEAN'
  const value: VariableValue =
    typeof tree === 'object' && 'operator' in tree
      ? { expression: 'FORMULA', type, value: tree }
      : tree
  const visiting = new Set<string>()
  const memo = new Map<string, VariableLiteral>()
  const resolve = (id: string): VariableLiteral => {
    const cached = memo.get(id)
    if (cached !== undefined) return cached
    if (visiting.has(id)) throw new VariableFormulaError('Circular variable reference')
    if (visiting.size >= MAX_FORMULA_DEPTH)
      throw new VariableFormulaError('Too many linked variables')
    const target = graph.variables.get(id)
    if (!target) throw new VariableFormulaError(`Missing variable: ${id}`)
    if (target.type !== variable.type)
      throw new VariableFormulaError(`Incompatible variable type: ${target.name}`)
    const targetMode =
      target.collectionId === variable.collectionId
        ? modeId
        : graph.getActiveModeId(target.collectionId)
    const definition = id === variableId ? value : variableValueInMode(graph, target, targetMode)
    if (definition === undefined) throw new VariableFormulaError(`Missing value: ${target.name}`)
    visiting.add(id)
    try {
      // Resolve dependencies first so the safe canvas resolver cannot conceal a diagnostic.
      for (const reference of variableValueReferences(definition)) resolve(reference)
      const result =
        typeof definition === 'object' &&
        'expression' in definition &&
        definition.expression === 'FORMULA'
          ? evaluateVariableFormula(definition.value, resolve)
          : resolveVariableValue(definition, resolve)
      const expected = target.type === 'FLOAT' ? 'number' : 'boolean'
      if (typeof result !== expected)
        throw new VariableFormulaError(`Wrong result type: ${target.name}`)
      if (typeof result === 'number' && !Number.isFinite(result))
        throw new VariableFormulaError(`Non-finite value: ${target.name}`)
      if (result === undefined) throw new VariableFormulaError(`Cannot resolve ${target.name}`)
      memo.set(id, result)
      return result
    } finally {
      visiting.delete(id)
    }
  }
  const resolved = resolve(variableId)
  if (typeof resolved !== 'number' && typeof resolved !== 'boolean')
    throw new VariableFormulaError('Expected a number or Boolean result')
  return { value, resolved }
}
