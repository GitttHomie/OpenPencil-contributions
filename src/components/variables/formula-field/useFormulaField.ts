import {
  autocompletion,
  completionKeymap,
  completionStatus,
  acceptCompletion,
  closeCompletion
} from '@codemirror/autocomplete'
import { defaultKeymap, history, isolateHistory, redo, undo } from '@codemirror/commands'
import { Annotation, EditorSelection, EditorState, Prec } from '@codemirror/state'
import { EditorView, keymap } from '@codemirror/view'
import { watch, type Ref, type ShallowRef } from 'vue'

import { useCodeMirror } from '@/components/code-editor/useCodeMirror'
import { formulaEditorTheme } from '@/theme/code/formula'

import { completeFormula, type FormulaCompletion } from './completion'
import { formulaReferences, referencePills } from './references'
import { formulaSegments, type FormulaPill, type FormulaSelection } from './source'

interface FormulaFieldOptions {
  completions: () => readonly FormulaCompletion[]
  label: () => string
  attributes: () => Record<string, string>
  resolve: (source: string) => FormulaPill | undefined
  removeLabel: (name: string) => string
  onChange: () => void
  onEnter: () => void
  onCancel: () => void
  onSelection: (range: FormulaSelection) => void
}

const externalUpdate = Annotation.define<boolean>()

/** CodeMirror owns document edits, atomic references, selection, composition and history. */
export function useFormulaField(
  host: Readonly<ShallowRef<HTMLDivElement | null>>,
  model: Ref<string>,
  options: FormulaFieldOptions
) {
  const view = useCodeMirror(host, {
    doc: () => model.value,
    label: options.label,
    theme: formulaEditorTheme,
    extensions: [
      history(),
      autocompletion({ override: [completeFormula(options.completions)] }),
      keymap.of([...completionKeymap, { key: 'Tab', run: acceptCompletion }]),
      referencePills,
      EditorView.lineWrapping,
      keymap.of(defaultKeymap),
      EditorState.transactionFilter.of((transaction) =>
        transaction.newDoc.lines > 1 ? [] : transaction
      ),
      EditorView.clipboardInputFilter.of((text) => text.replace(/[\r\n]+/g, ' ')),
      Prec.highest(
        EditorView.domEventHandlers({
          keydown(event, editor) {
            if (event.isComposing) return false
            if (
              (event.metaKey || event.ctrlKey) &&
              (event.code === 'KeyZ' || event.code === 'KeyY')
            ) {
              event.preventDefault()
              event.stopPropagation()
              if (event.shiftKey || event.code === 'KeyY') redo(editor)
              else undo(editor)
              return true
            }
            if (event.code === 'Enter' || event.code === 'Escape') {
              event.preventDefault()
              event.stopPropagation()
              if (completionStatus(editor.state) === 'active') {
                if (event.code === 'Escape') closeCompletion(editor)
                else acceptCompletion(editor)
                return true
              }
              if (event.code === 'Enter') options.onEnter()
              else options.onCancel()
              return true
            }
            return false
          },
          blur(event, editor) {
            if (event.relatedTarget instanceof Node && editor.dom.contains(event.relatedTarget))
              return false
            options.onChange()
            return false
          }
        })
      ),
      EditorView.updateListener.of((update) => {
        if (
          update.docChanged &&
          !update.transactions.some((transaction) => transaction.annotation(externalUpdate))
        )
          model.value = update.state.doc.toString()
        if (update.docChanged || update.selectionSet || update.focusChanged) {
          const { from, to } = update.state.selection.main
          options.onSelection({ start: from, end: to })
        }
      })
    ],
    reactive: [
      () => EditorView.contentAttributes.of(options.attributes()),
      () =>
        formulaReferences.of(
          new Map(
            formulaSegments(model.value, options.resolve).flatMap(({ source, pill }) =>
              pill ? [[source, { ...pill, removeLabel: options.removeLabel(pill.label) }]] : []
            )
          )
        )
    ]
  })

  watch(model, (value) => {
    const editor = view.value
    if (!editor || editor.state.doc.toString() === value) return
    const { anchor, head } = editor.state.selection.main
    editor.dispatch({
      changes: { from: 0, to: editor.state.doc.length, insert: value },
      selection: EditorSelection.single(
        Math.min(anchor, value.length),
        Math.min(head, value.length)
      ),
      annotations: [externalUpdate.of(true), isolateHistory.of('full')]
    })
    // Keep the explicit post-replacement range in CodeMirror's selection history for redo.
    editor.dispatch({ selection: editor.state.selection })
  })

  return {
    focus: () => view.value?.focus(),
    blur: () => view.value?.contentDOM.blur(),
    setSelectionRange: (start: number, end: number) => {
      const editor = view.value
      if (!editor) return
      editor.dispatch({ selection: EditorSelection.single(start, end) })
    }
  }
}
