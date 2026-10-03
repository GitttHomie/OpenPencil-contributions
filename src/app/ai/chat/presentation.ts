import type { UIMessage } from 'ai'
import { shallowReactive } from 'vue'

import { stripReferencedNodeContext } from '@/app/ai/chat/context'

const visibleText = shallowReactive(new Map<string, string>())

/** Older ACP transcripts stored each delta as a completed part with the same ID. */
export function coalesceReasoningParts(parts: UIMessage['parts']): UIMessage['parts'] {
  const result: UIMessage['parts'] = []
  for (const part of parts) {
    const previous = result.at(-1)
    if (
      part.type === 'reasoning' &&
      previous?.type === 'reasoning' &&
      part.id &&
      part.id === previous.id
    ) {
      result[result.length - 1] = { ...part, text: previous.text + part.text }
    } else {
      result.push(part)
    }
  }
  return result
}

export function visibleMessageText(messageId: string, fallback: string): string {
  return visibleText.get(messageId) ?? fallback
}

export function visibleUserMessageText(messageId: string, text: string): string {
  return visibleMessageText(messageId, stripReferencedNodeContext(text))
}

export function setVisibleMessageText(messageId: string, text: string): void {
  visibleText.set(messageId, text)
}

export function clearVisibleMessageText(): void {
  visibleText.clear()
}
