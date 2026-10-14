import { omit, pick } from 'es-toolkit/object'

import {
  getSharedStyles,
  SHARED_TEXT_STYLE_FIELDS,
  TEXT_BINDABLE_FIELDS,
  resolvedNumericBindings,
  resolvedValueBindings,
  resolvedRunBindings,
  textStyleApplication,
  textStyleProperties,
  type CharacterStyleOverride,
  type SceneNode
} from '@open-pencil/scene-graph'

import {
  captureDocumentChange,
  isEmptyDocumentChange,
  restoreDocumentChange
} from '#core/editor/history/document-change'
import type { createNodeActions } from '#core/editor/nodes'
import type { EditorContext } from '#core/editor/types'
import { loadBoundFonts } from '#core/editor/typography/bound-fonts'
import { textAutoResizeChanges } from '#core/layout/text-auto-resize'
import { textStyleChanges } from '#core/text/character-style'

import { addStyleDefinition } from './definitions'

const STYLE_BINDING_FIELDS = TEXT_BINDABLE_FIELDS.filter(
  (field) => field === 'fontStyle' || SHARED_TEXT_STYLE_FIELDS.some((key) => key === field)
)

export function createTextStyleActions(
  ctx: EditorContext,
  nodes: ReturnType<typeof createNodeActions>,
  preparePage: (pageId: string) => Promise<boolean>
) {
  function selectedText(id: string): SceneNode {
    const node = ctx.graph.getNode(id)
    if (node?.type !== 'TEXT' || node.sharedStyleType)
      throw new Error('Select a text layer to define a text style.')
    return node
  }

  function applyTextStyle(nodeId: string, styleId: string) {
    const target = selectedText(nodeId)
    const info = getSharedStyles(ctx.graph, 'text').find((style) => style.id === styleId)
    const definition = info && ctx.graph.getNode(info.nodeId)
    if (!definition) throw new Error('The text style is missing.')
    const changes = textStyleApplication(target, definition, styleId)
    const next = { ...target, ...changes }
    Object.assign(
      changes,
      resolvedNumericBindings(ctx.graph, next),
      resolvedValueBindings(ctx.graph, next)
    )
    const cleared = textStyleChanges(
      target,
      pick(changes, [...SHARED_TEXT_STYLE_FIELDS, 'textStyleId'])
    )
    changes.styleRuns = (cleared.styleRuns ?? []).map((run) => ({
      ...run,
      style: {
        ...run.style,
        boundVariables: omit(run.style.boundVariables ?? {}, STYLE_BINDING_FIELDS)
      }
    }))
    nodes.updateNodeWithUndo(nodeId, changes, 'Apply text style')
    loadBoundFonts(ctx, [nodeId])
  }

  function createTextStyle(nodeId: string, name: string): string {
    const target = selectedText(nodeId)
    const trimmed = name.trim()
    if (!trimmed) throw new Error('Enter a style name.')
    return ctx.undo.runBatch('Create text style', () => {
      const style = addStyleDefinition(ctx, 'TEXT', {
        ...textStyleProperties(target),
        name: trimmed
      })
      const id = style.source.id
      if (!id) throw new Error('Missing style identity.')
      applyTextStyle(target.id, id)
      ctx.requestRender()
      return id
    })
  }

  /** Load unopened pages before finding consumers, without changing the visible page. */
  async function updateTextStyle(nodeId: string): Promise<number> {
    const graph = ctx.graph
    const initial = selectedText(nodeId)
    const styleId = initial.textStyleId
    if (!styleId) throw new Error('The selected text has no linked style.')
    for (const page of graph.getPages()) {
      if (!(await preparePage(page.id)) || ctx.graph !== graph)
        throw new Error('The document changed before its style could be updated.')
    }
    const target = selectedText(nodeId)
    if (target.textStyleId !== styleId) throw new Error('The selected text style changed.')
    const info = getSharedStyles(graph, 'text').find((style) => style.id === styleId)
    const definition = info && graph.getNode(info.nodeId)
    if (!definition) throw new Error('The linked text style is missing.')
    const selectedIds = new Set(ctx.state.selectedIds)
    const finish = captureDocumentChange(graph, ctx.state.currentPageId)
    const restore = (change: ReturnType<typeof finish>, side: 'before' | 'after') => {
      restoreDocumentChange(ctx, change, side)
      ctx.setSelectedIds(new Set([...selectedIds].filter((id) => graph.getNode(id))))
    }
    let count = 0
    const changedIds: string[] = []
    try {
      graph.updateNode(definition.id, textStyleProperties(target))
      const properties = textStyleProperties(definition)
      const rangeProperties: CharacterStyleOverride = {
        ...pick(properties, SHARED_TEXT_STYLE_FIELDS),
        boundVariables: properties.boundVariables
      }
      await ctx.runMutationWithLayout(() => {
        for (const consumer of graph.nodes.values()) {
          if (consumer.type !== 'TEXT' || consumer.sharedStyleType) continue
          const direct = consumer.textStyleId === styleId
          const styleRuns = consumer.styleRuns.map((run) =>
            run.style.textStyleId === styleId
              ? {
                  ...run,
                  style: {
                    ...run.style,
                    ...structuredClone(rangeProperties),
                    boundVariables: {
                      ...omit(run.style.boundVariables ?? {}, STYLE_BINDING_FIELDS),
                      ...rangeProperties.boundVariables
                    }
                  }
                }
              : run
          )
          const ranges = styleRuns.some((run, index) => run !== consumer.styleRuns[index])
          if (!direct && !ranges) continue
          const changes = direct ? textStyleApplication(consumer, definition, styleId) : {}
          if (ranges) changes.styleRuns = styleRuns
          const next = { ...consumer, ...changes }
          Object.assign(
            changes,
            resolvedNumericBindings(graph, next),
            resolvedValueBindings(graph, next),
            resolvedRunBindings(graph, next)
          )
          graph.updateNode(consumer.id, { ...changes, ...textAutoResizeChanges(consumer, changes) })
          count++
          changedIds.push(consumer.id)
        }
      })
    } catch (error) {
      restore(finish(), 'before')
      throw error
    }
    const change = finish()
    if (!isEmptyDocumentChange(change))
      ctx.undo.push({
        label: 'Update text style',
        forward: () => restore(change, 'after'),
        inverse: () => restore(change, 'before')
      })
    ctx.requestRender()
    loadBoundFonts(ctx, changedIds)
    return count
  }

  return { createTextStyle, updateTextStyle, applyTextStyle }
}
