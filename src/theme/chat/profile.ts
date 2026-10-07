import { tv } from 'tailwind-variants'

import { controlHeight } from '@/theme/control'

import { motionStyles } from '../motion/styles'

export const chatProfileTheme = tv({
  slots: {
    trigger: `flex ${controlHeight.sm} min-w-0 max-w-full flex-1 items-center gap-1.5 rounded-md smooth-corners border border-transparent bg-transparent px-2 py-0 text-xs text-muted outline-none hover:bg-hover hover:text-surface focus-visible:border-panel-focus disabled:cursor-not-allowed disabled:opacity-60`,
    triggerIcon: 'size-3.5 shrink-0',
    triggerValue: 'min-w-0 flex-1 truncate text-left',
    triggerChevron: 'size-3 shrink-0',
    content: ['w-72 max-w-[calc(100vw-1rem)] overflow-hidden', motionStyles.floating],
    viewport: 'max-h-72 p-1',
    header: 'px-2 pt-1.5 pb-2',
    headerLabel: 'text-[9px] font-medium tracking-wide text-muted uppercase',
    headerDescription: 'mt-0.5 text-[9px] leading-3 text-muted',
    item: 'grid h-auto min-h-11 grid-cols-[14px_minmax(0,1fr)_auto] gap-2 rounded px-2 py-1.5',
    indicator: 'flex size-3.5 shrink-0 items-center justify-center text-accent',
    indicatorIcon: 'size-3',
    text: 'min-w-0',
    name: 'block truncate text-[11px] leading-4 font-medium',
    metadata: 'block truncate text-[9px] leading-3 text-muted',
    capability: 'size-3 shrink-0 text-muted',
    footer:
      'mt-1 flex w-full cursor-pointer items-center gap-1.5 border-t border-border px-2 py-1.5 text-left text-[10px] text-muted hover:bg-hover hover:text-surface',
    footerIcon: 'size-3 shrink-0'
  }
})
