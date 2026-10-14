import { expect } from 'bun:test'

import { expectDefined } from '#core-tests/helpers/assert'

import type { SceneNode } from '@open-pencil/scene-graph'

import { createEditor } from '#core/editor'
import { exportFigFile, parseFigFile } from '#core/io'
import { initCodec } from '#core/kiwi'
import { computeAllLayouts, setTextMeasurer } from '#core/layout'

export const kinds = ['frame', 'component', 'instance'] as const
export const states = ['fresh', 'reopened', 'retained'] as const

export async function savedLayoutScenario(
  kind: (typeof kinds)[number],
  state: (typeof states)[number],
  fixedHeight = false
) {
  setTextMeasurer((node, width) => ({
    width: width ?? node.text.length * 8,
    height: node.fontSize * Math.max(1, Math.ceil((node.text.length * 8) / (width ?? Infinity)))
  }))
  let editor = createEditor()
  const graph = editor.graph
  const page = editor.state.currentPageId
  const source = graph.createNode(kind === 'frame' ? 'FRAME' : 'COMPONENT', page, {
    name: kind === 'instance' ? 'Definition' : 'Subject',
    width: 240,
    height: 160,
    layoutMode: 'VERTICAL',
    primaryAxisSizing: fixedHeight ? 'FIXED' : 'HUG',
    counterAxisSizing: 'FIXED',
    paddingLeft: 8,
    paddingRight: 8,
    paddingTop: 8,
    paddingBottom: 8,
    itemSpacing: 4
  })
  const body = graph.createNode('FRAME', source.id, {
    name: 'Body',
    width: 224,
    layoutMode: 'VERTICAL',
    primaryAxisSizing: 'HUG',
    counterAxisSizing: 'FIXED',
    layoutAlignSelf: 'STRETCH',
    itemSpacing: 4
  })
  for (const [name, fontSize] of [
    ['Title', 20],
    ['Subtext', 12]
  ] as const)
    graph.createNode('TEXT', body.id, {
      name,
      text: name,
      fontSize,
      width: 224,
      height: fontSize,
      textAutoResize: 'HEIGHT',
      layoutAlignSelf: 'STRETCH'
    })
  graph.createNode('FRAME', source.id, { name: 'Footer', width: 80, height: 16 })
  editor.runLayoutForNode(source.id)
  if (kind !== 'frame') {
    graph.createInstance(source.id, page, { name: kind === 'instance' ? 'Subject' : 'Copy' })
  }
  await settle()
  computeAllLayouts(graph)
  await settle()

  function target() {
    return expectDefined([...editor.graph.getAllNodes()].find((n) => n.name === 'Subject'))
  }
  function node(name: string, parent = target()): SceneNode {
    return expectDefined(editor.graph.getChildren(parent.id).find((n) => n.name === name))
  }
  function affected() {
    const subject = target()
    return kind === 'component' ? [subject, ...editor.graph.getInstances(subject.id)] : [subject]
  }
  async function settle() {
    await Promise.resolve()
    await Promise.resolve()
  }
  async function edit(nodeId: string, changes: Partial<SceneNode>) {
    editor.updateNodeWithUndo(nodeId, changes)
    await settle()
  }
  async function reopen() {
    await initCodec()
    const restored = await parseFigFile((await exportFigFile(editor.graph)).slice().buffer)
    editor.dispose()
    editor = createEditor({ graph: restored })
    computeAllLayouts(restored)
    await settle()
  }
  function retainGeometry() {
    editor.graph.preserveSourceMetadataDuring(() => {
      for (const n of editor.graph.getAllNodes()) {
        if (n.type === 'CANVAS') continue
        editor.graph.updateNode(n.id, {
          source: { ...n.source, format: 'fig', editedFields: [] },
          derivedLayout: { x: n.x, y: n.y, width: n.width, height: n.height }
        })
      }
    })
  }
  function assertFlow(gap = 4, padding = 8, bodyHeight = 36, footerHeight = 16) {
    for (const frame of affected()) {
      const body = node('Body', frame)
      const footer = node('Footer', frame)
      expect(body.x).toBe(padding)
      expect(body.y).toBe(padding)
      expect(body.width).toBe(frame.width - padding * 2)
      expect(body.height).toBe(bodyHeight)
      expect(footer.x).toBe(padding)
      expect(footer.y).toBe(padding + bodyHeight + gap)
      expect(footer.height).toBe(footerHeight)
      expect(frame.height).toBe(fixedHeight ? 160 : padding * 2 + bodyHeight + gap + footerHeight)
    }
  }
  if (state !== 'fresh') await reopen()
  if (state === 'retained') retainGeometry()
  editor.undo.clear()
  return {
    get editor() {
      return editor
    },
    get graph() {
      return editor.graph
    },
    target,
    node,
    affected,
    edit,
    settle,
    reopen,
    retainGeometry,
    assertFlow,
    dispose() {
      editor.dispose()
      setTextMeasurer(null)
    }
  }
}
