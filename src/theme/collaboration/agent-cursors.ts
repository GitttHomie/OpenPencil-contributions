import { tv } from 'tailwind-variants'

export const agentCursors = tv({
  slots: {
    root: 'pointer-events-none absolute inset-0 z-20 overflow-hidden',
    plane: 'absolute top-0 left-0 origin-top-left',
    pointer:
      'absolute top-0 left-0 origin-top-left transition-transform duration-600 ease-[cubic-bezier(0.22,0.61,0.36,1)] will-change-transform data-[animated=false]:transition-none motion-reduce:transition-none',
    artwork: 'absolute top-0 left-0 origin-top-left',
    arrow: 'absolute -top-px -left-px size-4 fill-current stroke-white',
    label:
      'absolute top-2.5 left-2 flex h-4 max-w-40 items-center gap-0.5 rounded border border-current bg-white px-1 text-[10px] leading-3',
    sparkle: 'size-2 shrink-0 fill-current',
    name: 'truncate'
  }
})
