import valueParser, { type Node } from 'postcss-value-parser'

/**
 * What a piece of a CSS value is. A finished `var(--name)` is one `reference`; while it is typed
 * it reads as a `function`, a `paren` and a `property`, the custom property name.
 */
export type CSSValueTokenKind =
  | 'reference'
  | 'property'
  | 'function'
  | 'paren'
  | 'number'
  | 'operator'
  | 'separator'
  | 'string'
  | 'keyword'

export interface CSSValueToken {
  kind: CSSValueTokenKind
  text: string
  from: number
  to: number
}

const OPERATORS = new Set(['+', '-', '*', '/'])

/** `var(--name)` with nothing else inside, which an editor can show as the variable it names. */
function isReference(node: valueParser.FunctionNode) {
  if (node.value !== 'var' || node.unclosed || node.nodes.length !== 1) return false
  const [argument] = node.nodes
  return argument.type === 'word' && argument.value.startsWith('--')
}

function wordKind(word: string): CSSValueTokenKind {
  if (word.startsWith('--')) return 'property'
  if (OPERATORS.has(word)) return 'operator'
  return valueParser.unit(word) ? 'number' : 'keyword'
}

/**
 * The tokens of one CSS value, such as `clamp(1rem, 4vw, var(--space-md))`, in order and with
 * their source ranges. Reading tolerates half-typed values: an unclosed function still gives
 * its name and its `(`.
 */
export function cssValueTokens(source: string): CSSValueToken[] {
  const tokens: CSSValueToken[] = []
  const push = (kind: CSSValueTokenKind, from: number, to: number) =>
    tokens.push({ kind, text: source.slice(from, to), from, to })
  const walk = (nodes: Node[]) => {
    for (const node of nodes) {
      if (node.type === 'function') {
        if (isReference(node)) {
          push('reference', node.sourceIndex, node.sourceEndIndex)
          continue
        }
        const open = node.sourceIndex + node.value.length
        if (node.value) push('function', node.sourceIndex, open)
        push('paren', open, open + 1)
        walk(node.nodes)
        if (!node.unclosed) push('paren', node.sourceEndIndex - 1, node.sourceEndIndex)
      } else if (node.type === 'word') {
        push(wordKind(node.value), node.sourceIndex, node.sourceEndIndex)
      } else if (node.type === 'div') {
        push(node.value === '/' ? 'operator' : 'separator', node.sourceIndex, node.sourceEndIndex)
      } else if (node.type === 'string') {
        push('string', node.sourceIndex, node.sourceEndIndex)
      }
    }
  }
  walk(valueParser(source).nodes)
  return tokens
}

/** The custom property a `reference` token names, such as `--space-md`. */
export function cssReferenceProperty(token: CSSValueToken) {
  return token.text.slice(token.text.indexOf('(') + 1, -1).trim()
}
