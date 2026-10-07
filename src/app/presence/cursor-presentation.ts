import type { PresenceCursor } from '@open-pencil/core/canvas'

/** Stable identities let each agent keep its own compositor animation across tool updates. */
export function hasAgentPointer(cursor: PresenceCursor): cursor is PresenceCursor & { id: string } {
  return cursor.kind === 'agent' && Boolean(cursor.id)
}

/** Keep selections on Skia; the app draws identified agent pointers in a separate DOM layer. */
export function canvasPresenceCursors(cursors: PresenceCursor[]): PresenceCursor[] {
  return cursors.map((cursor) =>
    hasAgentPointer(cursor) ? { ...cursor, pointerVisible: false } : cursor
  )
}
