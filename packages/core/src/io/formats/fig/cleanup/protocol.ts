import type { FigCleanupOptions, FigCleanupChoice } from '@open-pencil/fig'

export type CleanupRequest =
  | { type: 'analyze'; bytes: ArrayBuffer }
  | { type: 'apply'; choice: Exclude<FigCleanupChoice, 'keep'> }

export type CleanupResponse =
  | { type: 'summary'; summary: FigCleanupOptions }
  | { type: 'cleaned'; bytes: Uint8Array<ArrayBuffer> }
  | { type: 'error'; message: string }
