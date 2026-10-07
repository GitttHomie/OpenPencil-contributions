import { tv } from 'tailwind-variants'

export const preparationScreen = tv({
  slots: {
    root: 'absolute inset-0 z-50 flex items-center justify-center bg-[var(--loader-bg)] text-[rgb(var(--loader-fg))]',
    content: 'flex w-72 max-w-full flex-col items-center gap-4 px-4 text-center',
    artwork: 'size-[var(--loader-artwork-size)]',
    label: 'text-sm font-medium opacity-80',
    detail: 'truncate text-xs opacity-50',
    track: 'h-0.5 w-[var(--loader-progress-width)] overflow-hidden rounded-full bg-current/10',
    indicator:
      'h-full w-2/5 animate-[slide_1s_ease-in-out_infinite] rounded-full bg-current motion-reduce:animate-none',
    step: 'h-full flex-1 bg-transparent transition-colors duration-150 data-[complete=true]:bg-current motion-reduce:transition-none',
    count: 'text-xs tabular-nums opacity-50'
  }
})
