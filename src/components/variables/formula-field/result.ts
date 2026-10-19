import { Facet } from '@codemirror/state'
import { Decoration, EditorView, WidgetType } from '@codemirror/view'

/** What the value gives, such as `= 16px`, or a plain number's unit. */
export const formulaResult = Facet.define<string, string | undefined>({
  combine: (values) => values.at(-1) || undefined
})

class ResultWidget extends WidgetType {
  constructor(readonly text: string) {
    super()
  }

  eq(other: ResultWidget) {
    return this.text === other.text
  }

  toDOM(view: EditorView) {
    const element = view.dom.ownerDocument.createElement('span')
    element.className = 'cm-formula-result'
    // Floating is how the result keeps to the last line; its look is the editor theme's.
    element.style.float = 'right'
    element.ariaHidden = 'true'
    element.textContent = this.text
    return element
  }

  ignoreEvent() {
    return false
  }
}

/**
 * The result floats right after the text's end, so it takes room only on the last line and drops
 * to a line of its own when that line is full, rather than narrowing every line of the field.
 */
export const resultDecoration = EditorView.decorations.compute(['doc', formulaResult], (state) => {
  const text = state.facet(formulaResult)
  if (!text) return Decoration.none
  const end = state.doc.length
  return Decoration.set([Decoration.widget({ widget: new ResultWidget(text), side: 1 }).range(end)])
})
