import type { VariableLiteral, VariableValue } from '../types'
import { evaluateVariableFormula, mapFormulaReferences } from './formula/evaluate'

/** All references in one definition, including color and opacity operands. */
export function variableValueReferences(value: VariableValue): string[] {
  if (typeof value !== 'object') return []
  if ('aliasId' in value) return [value.aliasId]
  if ('expression' in value && value.expression === 'FORMULA') {
    const references: string[] = []
    mapFormulaReferences(value.value, (id) => {
      references.push(id)
      return id
    })
    return references
  }
  if ('expression' in value)
    return [...variableValueReferences(value.color), ...variableValueReferences(value.opacity)]
  return []
}

/** Clone a value while remapping its references for transfer to another document. */
export function mapVariableValueReferences(
  value: VariableValue,
  map: (id: string) => string
): VariableValue {
  if (typeof value !== 'object') return value
  if ('aliasId' in value) return { aliasId: map(value.aliasId) }
  if ('expression' in value && value.expression === 'FORMULA')
    return { ...value, value: mapFormulaReferences(value.value, map) }
  if ('expression' in value)
    return {
      expression: value.expression,
      color: 'aliasId' in value.color ? { aliasId: map(value.color.aliasId) } : { ...value.color },
      opacity:
        typeof value.opacity === 'object' ? { aliasId: map(value.opacity.aliasId) } : value.opacity
    }
  return { ...value }
}

/** Resolve operands through the caller's mode context; invalid results remain unresolved. */
export function resolveVariableValue(
  value: VariableValue,
  resolve: (id: string) => VariableLiteral | undefined
): VariableLiteral | undefined {
  if (typeof value !== 'object') return value
  if ('aliasId' in value) return resolve(value.aliasId)
  if (!('expression' in value)) return value
  if (value.expression === 'FORMULA') {
    try {
      const result = evaluateVariableFormula(value.value, resolve)
      return typeof result === (value.type === 'FLOAT' ? 'number' : 'boolean') ? result : undefined
    } catch {
      return undefined
    }
  }
  const color = 'aliasId' in value.color ? resolve(value.color.aliasId) : value.color
  const opacity = typeof value.opacity === 'object' ? resolve(value.opacity.aliasId) : value.opacity
  if (
    !color ||
    typeof color !== 'object' ||
    !Object.values(color).every(Number.isFinite) ||
    typeof opacity !== 'number' ||
    !Number.isFinite(opacity)
  )
    return undefined
  return { ...color, a: Math.min(1, Math.max(0, opacity / 100)) }
}
