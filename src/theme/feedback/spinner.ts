import { tv } from 'tailwind-variants'

import { motionStyles } from '@/theme/motion/styles'

export const spinnerTheme = tv({
  slots: {
    root: 'relative inline-flex size-3.5 shrink-0 align-middle',
    track:
      'absolute inset-px block box-border rounded-full border-[1.5px] border-current opacity-20',
    arc: `absolute inset-px block box-border origin-center rounded-full border-[1.5px] border-current border-r-transparent ${motionStyles.spinner}`
  }
})
