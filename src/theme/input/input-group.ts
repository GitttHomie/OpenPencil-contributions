export const inputGroupGap = 'gap-2'

export default {
  slots: {
    root: 'min-w-0 rounded-xl smooth-corners border border-border bg-input transition-colors hover:border-muted/60 focus-within:border-panel-focus focus-within:ring-1 focus-within:ring-accent/30',
    attachment: 'm-2 mb-0',
    control: 'min-w-0',
    toolbar: `grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center p-2 ${inputGroupGap}`,
    model: 'col-span-2 min-w-0',
    leading: `flex min-w-0 items-center ${inputGroupGap}`,
    actions: `col-start-2 flex shrink-0 items-center ${inputGroupGap}`
  },
  variants: {
    size: {
      // Intrinsic height keeps bottom padding outside the tallest control.
      xs: { toolbar: 'min-h-6' },
      sm: { toolbar: 'min-h-7' },
      md: { toolbar: 'min-h-8' }
    },
    disabled: {
      true: { root: 'opacity-60' }
    }
  },
  defaultVariants: {
    size: 'sm' as const,
    disabled: false
  }
}
