/** The source spelling stays intact when a reference is displayed as an atomic pill. */
export interface FormulaPill {
  label: string
  displayValue: string
}

export interface FormulaSelection {
  start: number
  end: number
}

export function formulaFieldText(node: Node): string {
  if (node instanceof HTMLElement && node.dataset.reference !== undefined)
    return node.dataset.reference
  if (node.nodeType === Node.TEXT_NODE) return node.textContent ?? ''
  if (node.nodeName === 'BR') return '\n'
  return [...node.childNodes].map(formulaFieldText).join('')
}

export function formulaFieldSelection(root: HTMLElement): FormulaSelection | null {
  const selection = root.ownerDocument.getSelection()
  if (!selection?.rangeCount) return null
  const range = selection.getRangeAt(0)
  if (!root.contains(range.startContainer) || !root.contains(range.endContainer)) return null
  const prefix = range.cloneRange()
  prefix.selectNodeContents(root)
  prefix.setEnd(range.startContainer, range.startOffset)
  const start = formulaFieldText(prefix.cloneContents()).length
  prefix.setEnd(range.endContainer, range.endOffset)
  return { start, end: formulaFieldText(prefix.cloneContents()).length }
}

export function selectFormulaField(root: HTMLElement, start: number, end = start) {
  const locate = (offset: number): [Node, number] => {
    let remaining = offset
    for (const [index, child] of [...root.childNodes].entries()) {
      const length = formulaFieldText(child).length
      if (remaining <= length) {
        if (child.nodeType === Node.TEXT_NODE) return [child, remaining]
        return [root, index + (remaining > 0 ? 1 : 0)]
      }
      remaining -= length
    }
    return [root, root.childNodes.length]
  }
  const range = root.ownerDocument.createRange()
  range.setStart(...locate(start))
  range.setEnd(...locate(end))
  const selection = root.ownerDocument.getSelection()
  selection?.removeAllRanges()
  selection?.addRange(range)
}

/** Rebuild only this editor's DOM, using text nodes so pasted source never becomes markup. */
export function renderFormulaField(
  root: HTMLElement,
  source: string,
  resolve: (reference: string) => FormulaPill | undefined,
  removeLabel: (name: string) => string,
  removeIcon: Element | null,
  classes: { pill: string; label: string; value: string; remove: string }
) {
  const document = root.ownerDocument
  const children: Node[] = []
  let offset = 0
  for (const match of source.matchAll(/\{[^{}]+\}/g)) {
    const reference = match[0]
    const pill = resolve(reference)
    if (!pill) continue
    children.push(document.createTextNode(source.slice(offset, match.index)))
    const element = document.createElement('span')
    element.contentEditable = 'false'
    element.dataset.reference = reference
    element.className = classes.pill
    const label = document.createElement('span')
    label.className = classes.label
    label.textContent = pill.label
    const value = document.createElement('span')
    value.className = classes.value
    value.textContent = pill.displayValue
    const remove = document.createElement('button')
    remove.type = 'button'
    remove.className = classes.remove
    remove.setAttribute('aria-label', removeLabel(pill.label))
    remove.dataset.removeReference = ''
    if (removeIcon) remove.append(removeIcon.cloneNode(true))
    element.append(label, value, remove)
    children.push(element)
    offset = match.index + reference.length
  }
  children.push(document.createTextNode(source.slice(offset)))
  root.replaceChildren(...children)
}
