import { shallowReactive, shallowRef } from 'vue'

import type { ToolChange } from './types'

const changes = shallowReactive(new Map<string, ToolChange>())
const aliases = shallowReactive(new Map<string, string>())
/** Bumped whenever a change is recorded or its images arrive, so the history saves it. */
export const toolChangesVersion = shallowRef(0)

/** Reactive in a computed or template: the map tracks reads by key. */
export function readToolChange(toolCallId: string): ToolChange | null {
  const change = changes.get(aliases.get(toolCallId) ?? toolCallId)
  return change ? { ...change, toolCallId } : null
}

export function linkToolChange(toolCallId: string, changeId: string): void {
  if (!changes.has(changeId)) return
  aliases.set(toolCallId, changeId)
  toolChangesVersion.value++
}

export function setToolChange(change: ToolChange): void {
  changes.set(change.toolCallId, change)
  toolChangesVersion.value++
}

export function clearToolChanges(): void {
  changes.clear()
  aliases.clear()
}
