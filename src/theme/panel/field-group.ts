export const panelFieldLabelText = 'text-[11px] leading-field-label'

const panelFieldGroupTheme = {
  slots: {
    root: 'min-w-0',
    label: [panelFieldLabelText, 'mb-field-label block truncate text-muted'],
    container: 'flex min-w-0 flex-col gap-1.5'
  }
}

export type PanelFieldGroupTheme = typeof panelFieldGroupTheme
export default panelFieldGroupTheme
