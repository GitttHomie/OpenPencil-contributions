import { panelFieldBase } from '../panel/field'

export default {
  slots: {
    root: [
      panelFieldBase,
      'flex flex-1 items-center overflow-hidden text-[11px] transition-colors'
    ],
    preview:
      'flex aspect-square h-full shrink-0 items-center justify-center [&>[data-slot=swatch-trigger]]:size-full [&>[data-slot=swatch-trigger]]:p-[3px]',
    value: 'flex min-w-0 flex-1 items-center px-1',
    divider: 'h-4 w-px shrink-0 bg-muted/40',
    opacity: 'h-full w-12 flex-none shrink-0',
    binding: 'flex aspect-square h-full shrink-0 items-center justify-center'
  }
} as const
