import { panelFieldBase } from '../panel/field'

export default {
  base: 'w-full resize-none outline-none placeholder:text-muted',
  variants: {
    tone: {
      default:
        'rounded-md smooth-corners border border-border bg-input px-3 py-2 text-xs leading-relaxed text-surface hover:border-muted/60 focus:border-panel-focus focus:ring-1 focus:ring-accent/25 disabled:cursor-not-allowed disabled:opacity-60',
      panel: [panelFieldBase, 'h-auto px-2 py-1 text-[11px] leading-relaxed']
    }
  },
  defaultVariants: { tone: 'default' as const }
}
