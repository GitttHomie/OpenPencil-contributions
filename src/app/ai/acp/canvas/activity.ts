import type { SessionUpdate } from '@agentclientprotocol/sdk'

import { TOOL_CHANGE_ID_FIELD } from '@open-pencil/core/constants'
import { computeContentBounds } from '@open-pencil/core/io'
import { ALL_TOOLS, isToolExposed } from '@open-pencil/core/tools'

import { linkToolChange } from '@/app/ai/tools/changes/store'
import type { EditorStore } from '@/app/editor/active-store'
import { thinkingCursor } from '@/app/presence/activity'
import { addAgent, type AgentHandle } from '@/app/presence/registry'

const canvasMutations = new Set(
  ALL_TOOLS.filter((tool) => tool.mutates && isToolExposed(tool, 'mcp')).map((tool) => tool.name)
)
const PREFIXES = [
  'mcp__open-pencil__',
  'mcp__open_pencil__',
  'mcp.open-pencil.',
  'mcp.open_pencil.',
  'mcp.openpencil.',
  '@open-pencil/',
  'open-pencil::'
]
const MAX_RESULT_CHARS = 256_000
const MAX_RESULT_ITEMS = 512
interface CanvasCall {
  title?: string | null
  input?: unknown
  output?: unknown
  content?: unknown
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function record(value: unknown): Record<string, unknown> | undefined {
  return isRecord(value) ? value : undefined
}

function isCanvasMutation(title: string | null | undefined, input: unknown): boolean {
  const prefix = PREFIXES.find((candidate) => title?.startsWith(candidate))
  if (prefix && title && canvasMutations.has(title.slice(prefix.length))) return true
  const args = record(input)
  if (typeof args?.tool_id === 'string' && args.tool_id.startsWith('open-pencil::')) {
    return canvasMutations.has(args.tool_id.slice('open-pencil::'.length))
  }
  return (
    typeof args?.server === 'string' &&
    ['open-pencil', 'open_pencil', 'openpencil'].includes(args.server) &&
    typeof args.tool === 'string' &&
    canvasMutations.has(args.tool)
  )
}

/** Only known result envelopes and node-bearing fields; never scan arbitrary prose for IDs. */
export function canvasResultNodeIds(value: unknown): string[] {
  const ids = new Set<string>()
  let remaining = MAX_RESULT_ITEMS
  function visit(item: unknown, depth: number): void {
    if (depth > 8 || remaining-- <= 0) return
    if (typeof item === 'string') {
      if (item.length > MAX_RESULT_CHARS || !/^\s*[[{]/.test(item)) return
      try {
        visit(JSON.parse(item), depth + 1)
      } catch {
        return
      }
      return
    }
    if (Array.isArray(item)) {
      for (const entry of item.slice(0, Math.max(0, remaining))) visit(entry, depth + 1)
      return
    }
    const object = record(item)
    if (!object || object.ok === false || object.isError === true || object.error || object.deleted)
      return
    if (typeof object.id === 'string') ids.add(object.id)
    for (const key of [
      'result',
      'results',
      'output',
      'siblings',
      'selection',
      'content',
      'structuredContent'
    ]) {
      if (key in object) visit(object[key], depth + 1)
    }
    if (object.type === 'text') visit(object.text, depth + 1)
  }
  visit(value, 0)
  return [...ids]
}

function inputTargets(input: unknown): string[] {
  const envelope = record(input)
  const args = record(envelope?.arguments) ?? envelope
  return [
    args?.id,
    args?.parent_id,
    args?.replace_id,
    ...(Array.isArray(args?.ids) ? args.ids : [])
  ].filter((id): id is string => typeof id === 'string')
}

function callTargets(call: CanvasCall, status: string | null | undefined): string[] {
  if (!isCanvasMutation(call.title, call.input)) return []
  if (status === 'in_progress') return inputTargets(call.input)
  if (status !== 'completed') return []
  const output = record(call.output)
  if (output?.ok === false || output?.isError === true || output?.error) return []
  const ids = canvasResultNodeIds(call.output)
  return ids.length ? ids : canvasResultNodeIds(call.content)
}

export function createACPCanvasActivity(store: EditorStore, model: string) {
  let agent: AgentHandle | undefined
  let running = false
  const calls = new Map<string, CanvasCall>()
  function pointAt(ids: string[]) {
    const nodes = ids.map((id) => store.graph.getNode(id)).filter((node) => node !== undefined)
    const first = nodes.at(0)
    if (!first) return
    function pageOf(id: string): string | undefined {
      let node = store.graph.getNode(id)
      while (node && node.type !== 'CANVAS' && node.parentId)
        node = store.graph.getNode(node.parentId)
      return node?.type === 'CANVAS' ? node.id : undefined
    }
    const pageId = pageOf(first.id)
    if (!pageId) return
    const selected = nodes.filter((node) => pageOf(node.id) === pageId).map((node) => node.id)
    const bounds = computeContentBounds(store.graph, selected)
    if (bounds)
      agent?.update({
        status: 'editing',
        pageId,
        cursor: { x: bounds.minX, y: bounds.minY, pageId },
        selection: selected
      })
  }
  return {
    start() {
      running = true
      calls.clear()
      agent ??= addAgent(store, 'acp', model)
      agent.update({
        status: 'thinking',
        pageId: store.state.currentPageId,
        cursor: thinkingCursor(store),
        selection: undefined
      })
    },
    update(update: SessionUpdate) {
      if (!running) return
      if (update.sessionUpdate !== 'tool_call' && update.sessionUpdate !== 'tool_call_update')
        return
      const call = calls.get(update.toolCallId) ?? {}
      call.title = update.title ?? call.title
      call.input = update.rawInput ?? call.input
      call.output = update.rawOutput ?? call.output
      call.content = update.content ?? call.content
      calls.set(update.toolCallId, call)
      if (isCanvasMutation(call.title, call.input)) {
        const changeId = canvasChangeId(call.output) ?? canvasChangeId(call.content)
        if (changeId) linkToolChange(update.toolCallId, changeId)
      }
      pointAt(callTargets(call, update.status))
      if (update.status === 'failed') agent?.update({ status: 'thinking', selection: undefined })
      if (update.status === 'completed' || update.status === 'failed')
        calls.delete(update.toolCallId)
    },
    finish() {
      running = false
      calls.clear()
      agent?.update({ status: 'idle', cursor: undefined, selection: undefined })
    },
    dispose() {
      running = false
      calls.clear()
      agent?.remove()
      agent = undefined
    }
  }
}

function canvasChangeId(value: unknown, depth = 0): string | undefined {
  if (depth > 8) return undefined
  if (typeof value === 'string' && value.length <= MAX_RESULT_CHARS) {
    try {
      return canvasChangeId(JSON.parse(value), depth + 1)
    } catch {
      return undefined
    }
  }
  if (Array.isArray(value)) {
    for (const item of value.slice(0, MAX_RESULT_ITEMS)) {
      const id = canvasChangeId(item, depth + 1)
      if (id) return id
    }
  }
  const object = record(value)
  if (!object) return undefined
  if (typeof object[TOOL_CHANGE_ID_FIELD] === 'string') return object[TOOL_CHANGE_ID_FIELD]
  for (const key of ['result', 'output', 'content', 'structuredContent', 'text']) {
    const id = canvasChangeId(object[key], depth + 1)
    if (id) return id
  }
  return undefined
}
