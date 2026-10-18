import { EditorView } from '@codemirror/view'

/** A single value field, without the gutters or panels of the full code editor. */
export function formulaEditorTheme(dark: boolean) {
  return EditorView.theme(
    {
      '&': { fontSize: '12px' },
      '&.cm-focused': { outline: 'none' },
      '.cm-scroller': { fontFamily: 'var(--font-mono)', overflow: 'auto' },
      '.cm-content': { whiteSpace: 'pre-wrap', caretColor: 'var(--color-primary)' },
      '.cm-line': { padding: '0' },
      '.cm-tooltip': {
        backgroundColor: 'var(--color-panel)',
        color: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: '4px'
      },
      '.cm-tooltip-autocomplete ul li': { padding: '4px 8px' },
      '.cm-tooltip-autocomplete ul li[aria-selected]': {
        backgroundColor: 'var(--color-hover)',
        color: 'var(--color-surface)'
      },
      '.cm-completionDetail': { color: 'var(--color-muted)', marginLeft: '12px' }
    },
    { dark }
  )
}
