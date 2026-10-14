import { panelFieldBase } from '../panel/field'

const bindingFieldTheme = {
  slots: {
    root: 'min-w-0',
    field: [panelFieldBase, 'flex min-h-6 flex-1 items-center'],
    control:
      'h-full w-full min-w-0 rounded-none border-0 bg-transparent p-0 hover:bg-transparent focus:bg-transparent focus-within:bg-transparent',
    content: 'flex h-full min-w-0 flex-1 items-center px-1',
    actions: 'flex h-full shrink-0 items-center pr-1 [&>[role=combobox]]:px-1',
    pill: 'flex min-w-0 flex-1 items-center gap-1.5 overflow-hidden rounded-sm bg-component/10 px-1 text-component outline-none',
    pillLabel: 'min-w-0 flex-1 truncate text-left text-[11px] font-medium',
    pillValue: 'max-w-[70%] shrink-0 truncate text-right text-[11px] tabular-nums',
    trigger:
      'flex size-5 shrink-0 cursor-pointer items-center justify-center rounded-sm border border-transparent bg-transparent text-muted outline-none transition-colors hover:text-surface focus-visible:border-panel-focus data-[open]:bg-hover data-[open]:text-surface disabled:opacity-0 data-[disabled]:opacity-0',
    createForm: 'flex items-center gap-1.5 p-1',
    createInput: [panelFieldBase, 'flex-1 px-2 text-[11px] placeholder:text-muted']
  },
  variants: {
    state: {
      unbound: {},
      bound: {
        trigger: 'text-surface opacity-100'
      },
      unresolved: { trigger: 'text-error opacity-100', pill: 'bg-error-bg text-error' },
      mixed: {}
    },
    open: {
      true: {
        trigger: 'bg-hover text-surface opacity-100'
      },
      false: {}
    },
    disabled: {
      true: {
        pill: 'bg-surface/5 text-muted opacity-60',
        trigger: 'pointer-events-none opacity-0'
      },
      false: {}
    },
    derived: {
      true: {
        pill: 'bg-surface/5 text-muted'
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
