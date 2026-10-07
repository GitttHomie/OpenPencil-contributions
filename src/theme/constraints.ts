const constraintsTheme = {
  slots: {
    root: 'grid grid-cols-[72px_minmax(0,1fr)] items-center gap-1.5',
    diagram: 'relative h-16 w-[72px] rounded-md smooth-corners border border-border bg-panel-field',
    pin: 'absolute flex cursor-pointer items-center justify-center rounded-sm border border-transparent bg-transparent text-muted outline-none hover:bg-hover hover:text-surface focus-visible:ring-1 focus-visible:ring-panel-focus',
    pinMark: 'block rounded-full bg-current',
    scaleBadge:
      'pointer-events-none absolute inset-2 flex items-center justify-center text-[9px] font-medium tracking-wide text-accent uppercase',
    selects: 'grid min-w-0 gap-field-group'
  },
  variants: {
    active: {
      true: { pin: 'bg-accent/8 text-accent' },
      false: {}
    },
    scale: {
      true: { diagram: 'ring-1 ring-accent/50' },
      false: {}
    },
    pinPosition: {
      horizontalLeading: { pin: 'top-1/2 left-1 h-7 w-4 -translate-y-1/2', pinMark: 'h-5 w-px' },
      horizontalTrailing: { pin: 'top-1/2 right-1 h-7 w-4 -translate-y-1/2', pinMark: 'h-5 w-px' },
      verticalLeading: { pin: 'top-1 left-1/2 h-4 w-7 -translate-x-1/2', pinMark: 'h-px w-5' },
      verticalTrailing: { pin: 'bottom-1 left-1/2 h-4 w-7 -translate-x-1/2', pinMark: 'h-px w-5' },
      horizontalCenter: {
        pin: 'bottom-1/2 left-1/2 h-3 w-6 -translate-x-1/2 border-transparent bg-transparent',
        pinMark:
          'pointer-events-none absolute top-1/2 left-1/2 z-10 h-4 w-px -translate-x-1/2 -translate-y-1/2 text-muted data-[active]:text-accent'
      },
      verticalCenter: {
        pin: 'top-1/2 left-1/2 h-3 w-6 -translate-x-1/2 border-transparent bg-transparent',
        pinMark:
          'pointer-events-none absolute top-1/2 left-1/2 z-10 h-px w-4 -translate-x-1/2 -translate-y-1/2 text-muted data-[active]:text-accent'
      }
    }
  },
  defaultVariants: {
    active: false,
    scale: false
  }
}

export type ConstraintsTheme = typeof constraintsTheme
export default constraintsTheme
