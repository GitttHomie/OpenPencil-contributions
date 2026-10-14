import { TOOL_CHANGE_ID_FIELD } from '@open-pencil/core/constants'
import { graphFromPageSnapshot } from '@open-pencil/core/editor'
import type { FigmaAPI } from '@open-pencil/core/figma-api'
import { toolChangesDocument, type ToolDef } from '@open-pencil/core/tools'

import { recordToolChange } from '@/app/ai/tools/changes/capture'
import { createMutex } from '@/app/ai/tools/mutex'
import { currentRun, recordRunBaseline, recordRunUndoEntry, runBaseline } from '@/app/ai/tools/run'
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
    start: (continuing = false) => {
      session.active = true
      session.generation++
      if (!continuing) session.pageId = store.state.currentPageId
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

export async function moveCanvasSession(
  id: string | undefined,
  pageId: string,
  { reveal = false }: { reveal?: boolean } = {}
): Promise<void> {
  const session = id ? sessions.get(id) : undefined
  if (!session?.active || session.store.graph.getNode(pageId)?.type !== 'CANVAS') return
  session.pageId = pageId
  // An explicit page switch in chat moves the view, just as it does for built-in AI.
  // Calls merely targeting another page must not take the user away from their work.
  if (reveal && session.store.state.currentPageId !== pageId) await session.store.switchPage(pageId)
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
  if (!runBaseline(store, pageId)) recordRunBaseline(currentRun(store), store.snapshotPage(pageId))
  const finishChange = store.captureDocumentChange(pageId)
  const previousEntry = store.undo.peekUndo()
  const run = currentRun(store)
  const changeId = crypto.randomUUID()
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
      const change = finishChange()
      // The automation executor owns history for both atomic and structural edits.
      // Track its entry for chat Revert without adding a second copy of the same edit.
      if (run === currentRun(store) && store.undo.peekUndo() !== previousEntry)
        recordRunUndoEntry(store, run, { tool: def.name, toolCallId: changeId }, previousEntry)
      try {
        recordToolChange(store, changeId, change)
      } catch (error) {
        console.warn('Could not record agent tool change', error)
      }
    } finally {
      release()
    }
  }
}
