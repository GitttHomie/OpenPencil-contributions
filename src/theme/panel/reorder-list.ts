import { tv } from 'tailwind-variants'

export const reorderListStyles = tv({
  slots: {
    list: 'flex flex-col gap-2',
    row: 'relative flex min-w-0 items-start gap-1 data-[dragging]:opacity-50',
    handle: 'mt-2 cursor-grab touch-none active:cursor-grabbing',
    content: 'min-w-0 flex-1',
    indicator:
      'pointer-events-none absolute inset-x-0 z-10 h-0.5 rounded-full bg-accent data-[position=before]:-top-1 data-[position=after]:-bottom-1'
  },
  variants: {
    density: {
      comfortable: {},
      compact: { list: 'gap-1.5', handle: 'mt-0' }
    }
  },
  defaultVariants: { density: 'comfortable' }
})
