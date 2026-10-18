import { isolateHistory } from '@codemirror/commands'
import { Facet, StateField, type EditorState } from '@codemirror/state'
import { Decoration, EditorView, WidgetType } from '@codemirror/view'
import { h, nextTick, render } from 'vue'

import FormulaReferencePill from './FormulaReferencePill.vue'
import { formulaSegments, type FormulaPill } from './source'

interface ReferencePill extends FormulaPill {
  removeLabel: string
}

export const formulaReferences = Facet.define<ReadonlyMap<string, ReferencePill>>()

class ReferenceWidget extends WidgetType {
  constructor(
    readonly source: string,
    readonly start: number,
    readonly end: number,
    readonly pill: ReferencePill
  ) {
    super()
  }

  eq(other: ReferenceWidget) {
    return (
      this.source === other.source &&
      this.start === other.start &&
      this.end === other.end &&
      this.pill.label === other.pill.label &&
      this.pill.displayValue === other.pill.displayValue &&
      this.pill.removeLabel === other.pill.removeLabel
    )
  }

  toDOM(view: EditorView) {
    const host = view.dom.ownerDocument.createElement('span')
    host.contentEditable = 'false'
    host.dataset.reference = this.source
    // Vue rendering flushes watchers; defer it until CodeMirror finishes its transaction.
    void nextTick(() => {
      if (!host.isConnected) return
      render(
        h(FormulaReferencePill, {
          pill: this.pill,
          removeLabel: this.pill.removeLabel,
          onRemove: () => {
            view.dispatch({
              changes: { from: this.start, to: this.end },
              selection: { anchor: this.start },
              annotations: isolateHistory.of('full'),
              userEvent: 'delete'
            })
            view.focus()
          }
        }),
        host
      )
      view.requestMeasure()
    })
    return host
  }

  destroy(host: HTMLElement) {
    void nextTick(() => render(null, host))
  }
}

function decorations(state: EditorState) {
  const references = state.facet(formulaReferences)[0]
  const ranges = []
  for (const { source, start, end } of formulaSegments(state.doc.toString(), (source) =>
    references?.get(source)
  )) {
    const pill = references?.get(source)
    if (pill)
      ranges.push(
        Decoration.replace({ widget: new ReferenceWidget(source, start, end, pill) }).range(
          start,
          end
        )
      )
  }
  return Decoration.set(ranges)
}

export const referencePills = StateField.define({
  create: decorations,
  update: (value, transaction) =>
    transaction.docChanged || transaction.reconfigured ? decorations(transaction.state) : value,
  provide: (field) => [
    EditorView.decorations.from(field),
    EditorView.atomicRanges.of((view) => view.state.field(field))
  ]
})
