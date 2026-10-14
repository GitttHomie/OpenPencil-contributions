import { expect } from 'bun:test'

import { expectDefined } from '#core-tests/helpers/assert'

import type { SceneNode } from '@open-pencil/scene-graph'

import { createEditor, isEmptyDocumentChange } from '#core/editor'
import { exportFigFile, parseFigFile } from '#core/io'
import { initCodec } from '#core/kiwi'
import { computeAllLayouts, setTextMeasurer } from '#core/layout'

export const documentStates = ['fresh', 'reopened'] as const

/** One realistic component family shared by the repeatable editing scenarios. */
export async function componentScenario(state: (typeof documentStates)[number]) {
  setTextMeasurer((node, width) => ({
    width: width ?? node.text.length * 8,
    height: node.fontSize * Math.max(1, Math.ceil((node.text.length * 8) / (width ?? Infinity)))
  }))
  let editor = createEditor()
  const graph = editor.graph
  const page = editor.state.currentPageId
  const card = graph.createNode('FRAME', page, {
    name: 'Card',
    width: 240,
    layoutMode: 'VERTICAL',
    primaryAxisSizing: 'HUG',
    counterAxisSizing: 'FIXED',
    paddingTop: 8,
    paddingBottom: 8,
    paddingLeft: 8,
    paddingRight: 8,
    itemSpacing: 4
  })
  graph.createNode('TEXT', card.id, {
    name: 'Title',
    text: 'Title',
    fontSize: 20,
    width: 224,
    height: 20,
    textAutoResize: 'HEIGHT',
    layoutAlignSelf: 'STRETCH'
  })
  graph.createNode('TEXT', card.id, {
    name: 'Subtext',
    text: 'Note',
    fontSize: 12,
    width: 224,
    height: 12,
    textAutoResize: 'HEIGHT',
    layoutAlignSelf: 'STRETCH'
  })
  editor.select([card.id])
  editor.createComponentFromSelection()
  const badge = graph.createNode('COMPONENT', page, { name: 'Badge', width: 24, height: 24 })
  graph.createNode('TEXT', badge.id, {
    name: 'Count',
    text: '1',
    width: 24,
    height: 16,
    fontSize: 16
  })
  const icon = graph.createNode('COMPONENT', page, { name: 'Icon', width: 32, height: 32 })
  graph.createNode('RECTANGLE', icon.id, { name: 'Glyph', width: 32, height: 32 })
  const list = graph.createNode('FRAME', page, {
    name: 'List',
    width: 300,
    layoutMode: 'VERTICAL',
    primaryAxisSizing: 'HUG',
    counterAxisSizing: 'FIXED',
    itemSpacing: 10
  })
  editor.runLayoutForNode(card.id)
  for (const name of ['First', 'Second']) {
    const instance = expectDefined(graph.createInstance(card.id, list.id, { name }))
    graph.updateNode(instance.id, { layoutAlignSelf: 'STRETCH' })
  }
  await settle()
  editor.runLayoutForNode(list.id)

  function node(name: string, parent?: SceneNode): SceneNode {
    const nodes = parent ? editor.graph.getChildren(parent.id) : [...editor.graph.getAllNodes()]
    return expectDefined(
      nodes.find((item) => item.name === name),
      name
    )
  }
  function copies() {
    return editor.graph.getChildren(node('List').id)
  }
  async function settle() {
    await Promise.resolve()
    await Promise.resolve()
  }
  async function reopen() {
    await settle()
    await initCodec()
    const data = await exportFigFile(editor.graph)
    const restored = await parseFigFile(data.slice().buffer)
    editor.dispose()
    editor = createEditor({ graph: restored })
    computeAllLayouts(restored)
    await settle()
  }
  /** Structural graph edits use the same incremental undo path as AI/MCP. */
  async function mutate(operation: () => void | Promise<void>) {
    const finish = editor.captureDocumentChange(editor.state.currentPageId)
    await editor.runMutationWithLayout(operation)
    const change = finish()
    if (!isEmptyDocumentChange(change))
      editor.pushUndoEntry({
        label: 'Scenario edit',
        forward: () => editor.restoreDocumentChange(change, 'after'),
        inverse: () => editor.restoreDocumentChange(change, 'before')
      })
    await settle()
  }
  function assertLinked() {
    const source = node('Card')
    expect(source.type).toBe('COMPONENT')
    for (const instance of copies()) {
      expect(instance.type).toBe('INSTANCE')
      expect(instance.componentId).toBe(source.id)
      expect(new Set(instance.childIds).size).toBe(instance.childIds.length)
      expect(editor.graph.getChildren(instance.id).map((child) => child.name)).toEqual(
        editor.graph.getChildren(source.id).map((child) => child.name)
      )
    }
  }
  if (state === 'reopened') await reopen()
  editor.undo.clear()
  return {
    get editor() {
      return editor
    },
    get graph() {
      return editor.graph
    },
    node,
    copies,
    settle,
    reopen,
    mutate,
    assertLinked,
    dispose() {
      editor.dispose()
      setTextMeasurer(null)
    }
  }
}

export type ComponentScenario = Awaited<ReturnType<typeof componentScenario>>
