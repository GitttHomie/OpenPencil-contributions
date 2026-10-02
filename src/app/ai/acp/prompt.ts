import SYSTEM_PROMPT from '@/app/ai/chat/system-prompt'

import canvasInstructions from './canvas-instructions.md?raw'

/** Repeat the canvas task boundary so later turns do not revert to CLI coding defaults. */
export function buildACPUserPrompt(text: string, includeReference: boolean): string {
  return [
    canvasInstructions.trim(),
    includeReference ? SYSTEM_PROMPT : '',
    '# Current user request',
    text
  ]
    .filter(Boolean)
    .join('\n\n')
}
