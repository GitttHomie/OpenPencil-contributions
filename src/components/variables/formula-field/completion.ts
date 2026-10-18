import {
  insertCompletionText,
  type Completion,
  type CompletionContext
} from '@codemirror/autocomplete'

export interface FormulaCompletion {
  label: string
  detail: string
  source: string
}

export function completeFormula(items: () => readonly FormulaCompletion[]) {
  return (context: CompletionContext) => {
    const reference = context.matchBefore(/\{[^{}]*$/)
    const word = context.matchBefore(/[\p{L}\p{N}_/:-]+$/u)
    const match = reference ?? word
    if (!match && !context.explicit) return null
    const from = match?.from ?? context.pos
    return {
      from: reference ? from + 1 : from,
      options: items().map(
        ({ label, detail, source }) =>
          ({
            label,
            detail,
            type: 'variable',
            apply(view, _completion, _from, to) {
              const end = reference && view.state.sliceDoc(to, to + 1) === '}' ? to + 1 : to
              view.dispatch(insertCompletionText(view.state, source, from, end))
            }
          }) satisfies Completion
      )
    }
  }
}
