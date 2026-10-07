import { TOOL_CHANGE_ID_FIELD } from '@open-pencil/core/constants'
import { graphFromPageSnapshot } from '@open-pencil/core/editor'
import type { FigmaAPI } from '@open-pencil/core/figma-api'
import { toolChangesDocument, type ToolDef } from '@open-pencil/core/tools'

import { recordToolChange } from '@/app/ai/tools/changes/capture'
import { createMutex } from '@/app/ai/tools/mutex'
import {
  recordRunBaseline,
  recordRunUndoEntry,
  runBaseline,
  runUndoEntries
} from '@/app/ai/tools/run'
import type { EditorStore } from '@/app/editor/active-store'

interface CanvasSession {
  store: EditorStore
  active: boolean
  generation: number
  pageId: string
  acquire: ReturnType<typeof createMutex>
}

const sessions = new Map<string, CanvasSession>()

function isCurrentTurn(session: CanvasSession, generation: number): boolean {
  return session.active && session.generation === generation
}

/** A connection identity, supplied by the app rather than by model-generated tool arguments. */
export function createCanvasSession(store: EditorStore) {
  const id = crypto.randomUUID()
  const session: CanvasSession = {
    store,
    generation: 0,
    active: false,
    pageId: store.state.currentPageId,
    acquire: createMutex()
  }
  sessions.set(id, session)
  return {
    id,
    start: () => {
      session.active = true
      session.generation++
      session.pageId = store.state.currentPageId
    },
    finish: () => {
      session.active = false
    },
    dispose: () => {
      sessions.delete(id)
    }
  }
}

export function canvasSessionStore(id?: string): EditorStore | undefined {
  return id ? sessions.get(id)?.store : undefined
}

export function canvasSessionPage(id?: string): string | undefined {
  return id ? sessions.get(id)?.pageId : undefined
}

export function moveCanvasSession(id: string | undefined, pageId: string): void {
  const session = id ? sessions.get(id) : undefined
  if (session?.active && session.store.graph.getNode(pageId)?.type === 'CANVAS')
    session.pageId = pageId
}

export function canvasSessionBaseline(id: string | undefined, figma: FigmaAPI): void {
  const session = id ? sessions.get(id) : undefined
  if (!session?.active || session.store.graph !== figma.graph) return
  figma.changeBaseline = (pageId) => {
    const baseline = runBaseline(session.store, pageId)
    return baseline ? graphFromPageSnapshot(session.store.graph, baseline) : null
  }
}

/** Track only commands from this chat's MCP connection, never unrelated canvas edits. */
export async function captureCanvasTool(
  id: string | undefined,
  store: EditorStore,
  pageId: string,
  def: ToolDef,
  execute: () => Promise<unknown>
): Promise<unknown> {
  const session = id ? sessions.get(id) : undefined
  if (!session?.active || session.store !== store || !toolChangesDocument(def)) return execute()
  const generation = session.generation
  const release = await session.acquire()
  if (!isCurrentTurn(session, generation)) {
    release()
    throw new Error('The originating chat turn has ended')
  }
  const before = store.snapshotPage(pageId)
  const previousEntry = store.undo.peekUndo()
  const entries = runUndoEntries(store)
  const changeId = crypto.randomUUID()
  recordRunBaseline(store, before)
  try {
    const response = await execute()
    if (response && typeof response === 'object' && 'result' in response) {
      const result = response.result
      if (result && typeof result === 'object' && !Array.isArray(result)) {
        return { ...response, result: { ...result, [TOOL_CHANGE_ID_FIELD]: changeId } }
      }
    }
    return response
  } finally {
    try {
      const after = store.snapshotPage(pageId)
      // The automation executor owns history for both atomic and structural edits.
      // Track its entry for chat Revert without adding a second copy of the same edit.
      if (entries === runUndoEntries(store) && store.undo.peekUndo() !== previousEntry)
        recordRunUndoEntry(store, `Agent: ${def.name}`)
      try {
        recordToolChange(store, changeId, before, after)
      } catch (error) {
        console.warn('Could not record agent tool change', error)
      }
    } finally {
      release()
    }
  }
}
