import { panelFieldBase } from '../panel/field'

const bindingFieldTheme = {
  slots: {
    root: 'min-w-0',
    pill: 'flex min-w-0 flex-1 items-center overflow-hidden rounded-sm px-1 text-component outline-none',
    pillLabel: 'min-w-0 flex-1 truncate text-[11px] font-medium',
    trigger:
      'flex size-5 shrink-0 cursor-pointer items-center justify-center rounded-sm border border-transparent bg-transparent text-muted outline-none transition-colors hover:text-surface focus-visible:border-panel-focus data-[open]:bg-hover data-[open]:text-component disabled:opacity-0 data-[disabled]:opacity-0',
    createForm: 'flex items-center gap-1.5 p-1',
    createInput: [panelFieldBase, 'flex-1 px-2 text-[11px] placeholder:text-muted']
  },
  variants: {
    state: {
      unbound: {},
      bound: {
        trigger: 'text-component opacity-100'
      },
      unresolved: { trigger: 'text-error opacity-100', pill: 'text-error' },
      mixed: {}
    },
    open: {
      true: {
        trigger: 'bg-hover text-component opacity-100'
      },
      false: {}
    },
    disabled: {
      true: {
        pill: 'text-muted opacity-60',
        trigger: 'pointer-events-none opacity-0'
      },
      false: {}
    },
    derived: {
      true: {
        pill: 'text-muted'
      },
      false: {}
    }
  },
  defaultVariants: {
    state: 'unbound' as const,
    open: false,
    disabled: false,
    derived: false
  }
}

export type BindingFieldTheme = typeof bindingFieldTheme
export default bindingFieldTheme
