import { EditorView } from '@codemirror/view'

/**
 * A one-line value field in the UI font, without the gutters or panels of the code editor. Its
 * completion list matches the variable picker: a floating surface with compact rows grouped by
 * collection, each value at the row's end.
 */
export function formulaEditorTheme(dark: boolean) {
  return EditorView.theme(
    {
      '&': { fontSize: '12px' },
      '&.cm-focused': { outline: 'none' },
      '.cm-scroller': {
        fontFamily: 'inherit',
        lineHeight: '20px',
        overflow: 'hidden'
      },
      '.cm-content': { padding: '0', caretColor: 'var(--color-surface)' },
      '.cm-line': { padding: '0' },
      '.cm-placeholder': { color: 'var(--color-muted)' },
      '.cm-tooltip.cm-tooltip-autocomplete': {
        backgroundColor: 'var(--color-panel)',
        color: 'var(--color-surface)',
        border: 'none',
        borderRadius: '12px',
        boxShadow: '0 0 0 1px var(--color-border), 0 8px 30px rgb(0 0 0 / 0.4)',
        padding: '4px',
        marginTop: '6px'
      },
      '.cm-tooltip.cm-tooltip-autocomplete > ul': {
        fontFamily: 'inherit',
        maxHeight: '15rem',
        minWidth: '14rem',
        maxWidth: '18rem'
      },
      '.cm-tooltip.cm-tooltip-autocomplete > ul > li': {
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        minHeight: '28px',
        padding: '0 4px',
        borderRadius: '4px',
        fontSize: '12px'
      },
      '.cm-tooltip.cm-tooltip-autocomplete > ul > li[aria-selected]': {
        backgroundColor: 'var(--color-hover)',
        color: 'var(--color-surface)'
      },
      '.cm-tooltip.cm-tooltip-autocomplete > ul > completion-section': {
        display: 'block',
        padding: '6px 4px 4px',
        border: 'none',
        fontSize: '10px',
        fontWeight: '500',
        letterSpacing: '0.025em',
        textTransform: 'uppercase',
        color: 'var(--color-muted)',
        opacity: '1'
      },
      '.cm-completionLabel': {
        flex: '1',
        minWidth: '0',
        overflow: 'hidden',
        textOverflow: 'ellipsis'
      },
      '.cm-completionMatchedText': { textDecoration: 'none', fontWeight: '600' },
      '.cm-completionDetail': {
        marginLeft: 'auto',
        fontStyle: 'normal',
        fontVariantNumeric: 'tabular-nums',
        color: 'var(--color-muted)'
      }
    },
    { dark }
  )
}
