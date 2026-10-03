export default {
  slots: {
    root: 'min-w-0 rounded-xl smooth-corners border border-border bg-input transition-colors hover:border-muted/60 focus-within:border-panel-focus focus-within:ring-1 focus-within:ring-accent/30',
    attachment: 'm-2 mb-0',
    control: 'min-w-0',
    toolbar: 'flex min-w-0 items-center gap-1 px-1.5 pb-1.5',
    model: 'min-w-0 flex-1',
    actions: 'ml-auto flex shrink-0 items-center gap-1'
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
