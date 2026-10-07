import type { FigmaAPI } from '@open-pencil/core/figma-api'

import { canvasSessionStore, canvasSessionPage } from '@/app/ai/acp/canvas/session'
import {
  handleActivateDocument,
  handleGetSettings,
  handleRedo,
  handleUndo,
  handleUpdateSettings
} from '@/app/automation/bridge/app-handlers'
import { createAutomationEvalHandler } from '@/app/automation/bridge/eval-handler'
import { handleExport, handleExportJSX } from '@/app/automation/bridge/export-handlers'
import {
  handleCloseFile,
  handleNewDocument,
  handleOpenFile,
  handleSaveFile
} from '@/app/automation/bridge/file-handlers'
import { handleRPCFallback } from '@/app/automation/bridge/rpc-handler'
import { handleSelection } from '@/app/automation/bridge/selection-handler'
import {
  isUnknownRecord,
  listAutomationDocuments,
  resolveAutomationTarget,
  responseWithTarget,
  stripAutomationTargetArgs,
  type AutomationTarget,
  type UnknownRecord
} from '@/app/automation/bridge/target'
import { createAutomationToolHandler } from '@/app/automation/bridge/tool-handlers'
import type { EditorStore } from '@/app/editor/active-store'

type FigmaFactory = (store: EditorStore, pageId?: string) => FigmaAPI

type CommandHandler = (target: AutomationTarget, args: unknown) => Promise<unknown>

export function createAutomationCommandHandlers(makeFigma: FigmaFactory) {
  const handleEval = createAutomationEvalHandler(makeFigma)
  const handleTool = createAutomationToolHandler(makeFigma)

  const commandHandlers: Partial<Record<string, CommandHandler>> = {
    eval: handleEval,
    tool: handleTool,
    export: handleExport,
    export_jsx: handleExportJSX,
    selection: handleSelection,
    save_file: handleSaveFile,
    close_file: handleCloseFile,
    new_document: handleNewDocument,
    open_file: handleOpenFile,
    activate_document: handleActivateDocument,
    undo: handleUndo,
    redo: handleRedo
  }

  /** Runs a command on a resolved document page, loading the page first if it was never shown. */
  async function handleTargetCommand(
    target: AutomationTarget,
    command: string,
    args: UnknownRecord,
    managedChatId?: string
  ): Promise<unknown> {
    if (!(await target.store.preparePageNodes(target.pageId))) {
      throw new Error(`Page "${target.pageId}" was closed before it finished loading`)
    }
    const handler = commandHandlers[command]
    let result: unknown
    if (command === 'tool') result = await handleTool(target, args, managedChatId)
    else if (handler) result = await handler(target, args)
    else result = await handleRPCFallback(target, command, args)
    return responseWithTarget(result, target)
  }

  async function handleRequest(
    store: EditorStore,
    command: string,
    args: unknown,
    managedChatId?: string
  ): Promise<unknown> {
    if (command === 'list_documents') {
      return { ok: true, result: { documents: listAutomationDocuments(store) } }
    }
    if (command === 'get_settings') return handleGetSettings()
    if (command === 'update_settings') return handleUpdateSettings(args)

    if (command === 'open_file' || command === 'new_document') {
      const handler = commandHandlers[command]
      if (handler) return handler(resolveAutomationTarget(store, undefined), args)
    }

    const rawArgs = isUnknownRecord(args) ? args : {}
    const target = resolveAutomationTarget(canvasSessionStore(managedChatId) ?? store, {
      ...rawArgs,
      page_id:
        rawArgs.page_id ?? (rawArgs.document_id ? undefined : canvasSessionPage(managedChatId))
    })
    return handleTargetCommand(target, command, stripAutomationTargetArgs(rawArgs), managedChatId)
  }

  return { handleRequest, handleTargetCommand }
}
