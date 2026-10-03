import { panelFieldBase } from '../panel/field'

const numberFieldTheme = {
  slots: {
    root: [
      panelFieldBase,
      'group flex min-h-6 flex-1 cursor-ew-resize items-center text-[11px] tabular-nums data-[disabled]:cursor-auto data-[editing]:cursor-auto'
    ],
    leading:
      'flex min-w-6 shrink-0 items-center justify-center self-stretch px-[5px] text-muted select-none [&>*]:pointer-events-none',
    field:
      'min-w-0 flex-1 cursor-text border-none bg-transparent text-right font-[inherit] text-[11px] text-surface outline-none',
    display: 'flex min-w-0 flex-1 items-center overflow-hidden text-[11px] select-none',
    mixed: 'flex-1 text-muted',
    value: 'min-w-0 flex-1 truncate text-right text-surface',
    trailing: 'flex shrink-0 items-center self-stretch',
    suffix: 'shrink-0 pr-1.5 text-muted'
  },
  variants: {
    suffix: {
      true: { display: 'pr-0', field: 'pr-0' },
      false: { display: 'pr-1.5', field: 'pr-1.5' }
    }
  }
}

export type NumberFieldTheme = typeof numberFieldTheme
export default numberFieldTheme
