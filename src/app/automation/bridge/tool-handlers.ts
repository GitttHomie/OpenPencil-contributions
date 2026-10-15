import type { FigmaAPI } from '@open-pencil/core/figma-api'
import {
  ALL_TOOLS,
  registerComponentCatalog,
  isAtomicTool,
  isToolExposed,
  toolChangesDocument
} from '@open-pencil/core/tools'
import type { RPCStage } from '@open-pencil/mcp/diagnostics'
import type { JSONObject } from '@open-pencil/scene-graph/primitives'

import {
  canvasSessionBaseline,
  captureCanvasTool,
  moveCanvasSession
} from '@/app/ai/acp/canvas/session'
import { designCheckState } from '@/app/ai/design-checks/state'
import {
  agentFinished,
  agentStarted,
  readAgentSession,
  touchedNodeIds
} from '@/app/automation/agents'
import { limitToSelection } from '@/app/automation/bridge/selection-scope'
import type { AutomationTarget } from '@/app/automation/bridge/target'
import {
  AUTOMATION_UNDO_LABEL,
  automationUndoLabel,
  executeAtomicEditorTool,
  executeWithDocumentUndo
} from '@/app/automation/execution/editor'
import { ensureGraphFonts } from '@/app/editor/fonts'
import { useLibraryService } from '@/app/libraries'

type FigmaFactory = (store: AutomationTarget['store'], pageId?: string) => FigmaAPI

export function createAutomationToolHandler(makeFigma: FigmaFactory) {
  async function executeTool(
    target: AutomationTarget,
    args: unknown,
    chatId?: string
  ): Promise<unknown> {
    const toolName = (args as { name?: string }).name
    const requestedArgs = (args as { args?: Record<string, unknown> }).args ?? {}
    if (!toolName) throw new Error('Missing "name" in args')
    const toolArgs =
      (args as { scope?: unknown }).scope === 'selection'
        ? limitToSelection(target.store, toolName, requestedArgs)
        : requestedArgs

    const def = ALL_TOOLS.find((t) => t.name === toolName && isToolExposed(t, 'mcp'))
    if (!def) throw new Error(`Unknown tool: ${toolName}`)
    const store = target.store
    if (chatId && toolChangesDocument(def) && designCheckState(store).readOnly) {
      return {
        ok: true,
        result: {
          error: 'This design check is read-only. Report findings without changing the canvas.'
        }
      }
    }
    const libraryService = useLibraryService()
    libraryService.bindEditor(store)
    registerComponentCatalog(store.graph, libraryService)
    const figma = makeFigma(store, target.pageId)
    // Managed chats already own a presence handle; external MCP sessions get their own.
    const session = chatId ? null : readAgentSession((args as { agent?: unknown }).agent)
    const reply = session ? agentStarted(store, session, target.pageId) : 0
    canvasSessionBaseline(chatId, figma)
    let result: unknown
    if (isAtomicTool(def)) {
      result = await executeAtomicEditorTool(store, figma, def, toolArgs, {
        label: AUTOMATION_UNDO_LABEL
      })
    } else if (def.mutates) {
      const pageId = writtenPageId(store.graph, toolArgs) ?? figma.currentPageId
      const mutate = () =>
        store.runMutationWithLayout(
          () => def.execute(figma, toolArgs),
          pageId,
          async () => {
            const pageNode = store.graph.getNode(pageId)
            if (pageNode) await ensureGraphFonts(store.graph, pageNode.childIds, store.renderer)
          }
        )
      // View tools (selection, viewport, pages) leave the document and its history alone.
      result = toolChangesDocument(def)
        ? await executeWithDocumentUndo(store, pageId, automationUndoLabel(def.name), mutate)
        : await mutate()
    } else {
      result = await def.execute(figma, toolArgs)
    }

    if (def.mutates) {
      store.requestRender()
      store.flashNodes(extractNodeIds(result))
    }
    if (figma.currentPageId !== target.pageId)
      await moveCanvasSession(chatId, figma.currentPageId, { reveal: true })
    if (session) {
      agentFinished(store, session, {
        reply,
        pageId: figma.currentPageId,
        nodeIds: touchedNodeIds(store, toolArgs, result),
        edited: toolChangesDocument(def)
      })
    }
    return { ok: true, result }
  }

  return async function handleTool(
    target: AutomationTarget,
    args: unknown,
    chatId?: string,
    progress?: (stage: RPCStage) => void
  ) {
    const name = (args as { name?: string }).name
    const def = ALL_TOOLS.find((tool) => tool.name === name && isToolExposed(tool, 'mcp'))
    progress?.('queued')
    const execute = () => {
      progress?.('executing')
      return executeTool(target, args, chatId)
    }
    return def ? captureCanvasTool(chatId, target.store, target.pageId, def, execute) : execute()
  }
}

/**
 * A parent or a replaced layer on another page puts the new layers there, so that page lays out,
 * loads their fonts, and records the change in its history.
 */
function writtenPageId(
  graph: AutomationTarget['store']['graph'],
  args: Record<string, unknown>
): string | null {
  // As render places it: a replaced layer's parent wins over parent_id.
  const nodeId = args.replace_id ?? args.parent_id
  return typeof nodeId === 'string' ? pageIdOf(graph, nodeId) : null
}

function pageIdOf(graph: AutomationTarget['store']['graph'], nodeId: string): string | null {
  let node = graph.getNode(nodeId)
  while (node && node.type !== 'CANVAS')
    node = node.parentId ? graph.getNode(node.parentId) : undefined
  return node?.id ?? null
}

function extractNodeIds(result: unknown): string[] {
  if (!result || typeof result !== 'object') return []
  const obj = result as JSONObject
  if (typeof obj.deleted === 'string') return []
  const ids: string[] = []
  if (typeof obj.id === 'string') ids.push(obj.id)
  if (Array.isArray(obj.results)) {
    for (const item of obj.results) {
      if (item && typeof item === 'object' && typeof (item as JSONObject).id === 'string')
        ids.push((item as JSONObject).id as string)
    }
  }
  return ids
}
