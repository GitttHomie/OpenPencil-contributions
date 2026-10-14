export const panelFieldLabelText = 'text-[11px] leading-field-label'

const panelFieldGroupTheme = {
  slots: {
    root: 'min-w-0',
    label: [panelFieldLabelText, 'block truncate text-muted'],
    container: 'flex min-w-0 flex-col gap-1.5'
  },
  variants: {
    layout: {
      stacked: { label: 'mb-field-label' },
      inline: {
        root: 'grid min-h-8 grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)] items-center gap-2'
      }
    }
  },
  defaultVariants: {
    layout: 'stacked' as const
  }
}

export type PanelFieldGroupTheme = typeof panelFieldGroupTheme
export default panelFieldGroupTheme
