import { tv } from 'tailwind-variants'

import { inputGroupGap } from '@/theme/input/input-group'

export const chatComposerTheme = tv({
  slots: {
    models: `@container/chat-models flex min-w-0 flex-wrap items-center ${inputGroupGap}`,
    routing: 'w-full min-w-0 truncate px-2 text-[10px] text-muted',
    reasoning: 'w-auto max-w-[50%] shrink-0'
  }
})
