import { tv } from 'tailwind-variants'

import { motionStyles } from '@/theme/motion/styles'

export const spinnerTheme = tv({
  slots: {
    root: 'relative inline-flex size-3.5 shrink-0 items-center justify-center align-middle',
    // Lucide's circle has radius 10; the loader arc has radius 9 in the same viewBox.
    track: 'block size-full origin-center scale-90 opacity-20',
    arc: `absolute inset-0 block size-full origin-center ${motionStyles.spinner}`
  }
})
