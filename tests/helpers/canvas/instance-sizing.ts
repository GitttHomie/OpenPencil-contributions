import { renderTree } from '@open-pencil/core/design-jsx'
import { exportFigFile } from '@open-pencil/core/io'
import { initCodec } from '@open-pencil/core/kiwi'
import { computeAllLayouts } from '@open-pencil/core/layout'
import { Component, Frame, Instance, Text } from '@open-pencil/design-jsx'
import { SceneGraph } from '@open-pencil/scene-graph'

export async function savedStalePaddingScene() {
  const graph = new SceneGraph()
  const page = graph.getPages()[0]
  if (!page) throw new Error('Page missing')
  const main = graph.createNode('COMPONENT', page.id, {
    name: 'Setting',
    x: 24,
    y: 40,
    width: 220,
    height: 104,
    layoutMode: 'VERTICAL',
    primaryAxisSizing: 'HUG',
    counterAxisSizing: 'FIXED',
    fills: [{ type: 'SOLID', color: { r: 1, g: 1, b: 1, a: 1 }, visible: true, opacity: 1 }]
  })
  const content = graph.createNode('FRAME', main.id, {
    name: 'Content',
    x: 24,
    y: 16,
    width: 172,
    height: 72,
    layoutMode: 'HORIZONTAL',
    primaryAxisSizing: 'FIXED',
    counterAxisSizing: 'HUG',
    layoutAlignSelf: 'STRETCH',
    fills: [{ type: 'SOLID', color: { r: 0.1, g: 0.4, b: 0.8, a: 1 }, visible: true, opacity: 1 }]
  })
  graph.createNode('FRAME', content.id, {
    name: 'Icon',
    width: 24,
    height: 72,
    fills: [{ type: 'SOLID', color: { r: 0.1, g: 0.1, b: 0.1, a: 1 }, visible: true, opacity: 1 }]
  })
  graph.createInstance(main.id, page.id, { name: 'Copy', x: 280, y: 40 })
  await initCodec()
  return exportFigFile(graph)
}

export function createSavedSpacingScene(graph: SceneGraph, parentId: string) {
  const main = graph.createNode('COMPONENT', parentId, {
    name: 'Spacing',
    x: 24,
    y: 32,
    width: 200,
    layoutMode: 'VERTICAL',
    primaryAxisSizing: 'HUG',
    counterAxisSizing: 'FIXED',
    paddingLeft: 16,
    paddingRight: 16,
    paddingTop: 16,
    paddingBottom: 16,
    itemSpacing: 8,
    fills: [{ type: 'SOLID', color: { r: 0.12, g: 0.16, b: 0.2, a: 1 }, opacity: 1, visible: true }]
  })
  for (const height of [40, 24])
    graph.createNode('FRAME', main.id, {
      name: `Row ${height}`,
      height,
      layoutAlignSelf: 'STRETCH',
      fills: [
        { type: 'SOLID', color: { r: 0.35, g: 0.75, b: 0.9, a: 1 }, opacity: 1, visible: true }
      ]
    })
  computeAllLayouts(graph, parentId)
  const copy = graph.createInstance(main.id, parentId, { x: 260, y: 32, name: 'Spacing copy' })
  computeAllLayouts(graph, parentId)
  graph.preserveSourceMetadataDuring(() => {
    for (const root of [main, copy])
      for (const node of [root, ...graph.getChildren(root.id)])
        graph.updateNode(node.id, {
          source: { ...node.source, format: 'fig', editedFields: [] },
          derivedLayout: { x: node.x, y: node.y, width: node.width, height: node.height }
        })
  })
  return { mainId: main.id, copyId: copy.id }
}

export async function createInstanceSizingScene(graph: SceneGraph, parentId: string) {
  const library = graph.addPage('Sizing component')
  const component = await renderTree(
    graph,
    Component({
      name: 'Note',
      flex: 'col',
      w: 280,
      h: 'hug',
      p: 16,
      bg: '#FFFFFF',
      rounded: 10,
      properties: [{ id: 'message', name: 'Message', type: 'TEXT', defaultValue: 'A short note.' }],
      children: Text({
        name: 'Message',
        w: 'fill',
        font: 'Inter',
        size: 14,
        lineHeight: 20,
        color: '#252A31',
        propertyRefs: [{ propertyId: 'message', field: 'TEXT' }],
        children: 'A short note.'
      })
    }),
    { parentId: library.id }
  )
  const board = await renderTree(
    graph,
    Frame({
      name: 'Instance sizing',
      flex: 'row',
      w: 'hug',
      h: 'hug',
      gap: 32,
      p: 32,
      bg: '#E9E7E2',
      children: [280, 220].map((width) =>
        Frame({
          name: `Container ${width}`,
          flex: 'col',
          w: width,
          h: 'hug',
          gap: 12,
          children: [
            Text({ children: `${width}px container`, font: 'Inter', size: 12, color: '#626975' }),
            Instance({
              of: component.id,
              w: 'fill',
              properties: {
                message:
                  'The blue feels right. Give the date a little more room at the bottom, and keep the quieter version for the print edition.'
              }
            })
          ]
        })
      )
    }),
    { parentId }
  )
  graph.syncInstances(component.id)
  return { boardId: board.id, componentId: component.id }
}

export async function createSavedFillNavigationScene(graph: SceneGraph, parentId: string) {
  const library = graph.addPage('Navigation component')
  const main = await renderTree(
    graph,
    Component({
      name: 'Navigation',
      flex: 'row',
      w: 390,
      h: 88,
      px: 8,
      bg: '#20252B',
      children: [30, 28, 45, 28].map((width) =>
        Frame({
          name: 'Tab',
          flex: 'col',
          w: 'fill',
          h: 'fill',
          align: 'center',
          justify: 'center',
          children: Frame({ name: 'Icon', w: width, h: 24, bg: '#77BFE3', rounded: 4 })
        })
      )
    }),
    { parentId: library.id }
  )
  const frames = []
  for (const [index, width] of [390, 470].entries()) {
    const frame = await renderTree(
      graph,
      Frame({
        name: `${width}px navigation`,
        flex: 'col',
        w: width,
        h: 88,
        children: Instance({ of: main.id, w: 'fill' })
      }),
      { parentId, x: 40, y: 60 + index * 140 }
    )
    const instance = graph.getChildren(frame.id)[0]
    if (!instance) throw new Error('Navigation instance missing')
    graph.updateNode(instance.id, {
      primaryAxisSizing: 'HUG',
      derivedLayout: { width: 390, height: 88 }
    })
    frames.push(instance)
  }
  computeAllLayouts(graph, parentId)
  return frames.map((instance) => ({
    width: instance.width,
    tabs: graph.getChildren(instance.id).map((tab) => tab.width)
  }))
}

export function createResizingComponentScene(graph: SceneGraph, parentId: string) {
  const library = graph.addPage('Settings component')
  const main = graph.createNode('COMPONENT', library.id, {
    name: 'Setting',
    width: 280,
    layoutMode: 'VERTICAL',
    primaryAxisSizing: 'HUG',
    counterAxisSizing: 'HUG',
    paddingLeft: 12,
    paddingRight: 12,
    paddingTop: 12,
    paddingBottom: 12,
    fills: [{ type: 'SOLID', color: { r: 1, g: 1, b: 1, a: 1 }, opacity: 1, visible: true }]
  })
  const content = graph.createNode('FRAME', main.id, {
    name: 'Content',
    width: 256,
    layoutMode: 'HORIZONTAL',
    primaryAxisSizing: 'FIXED',
    counterAxisSizing: 'HUG',
    layoutAlignSelf: 'STRETCH',
    itemSpacing: 8
  })
  graph.createNode('TEXT', content.id, {
    name: 'Label',
    text: 'Motion detection settings for your camera',
    fontFamily: 'Inter',
    fontSize: 16,
    lineHeight: 24,
    textAutoResize: 'HEIGHT',
    width: 224,
    layoutGrow: 1,
    fills: [{ type: 'SOLID', color: { r: 0.1, g: 0.1, b: 0.1, a: 1 }, opacity: 1, visible: true }]
  })
  graph.createNode('FRAME', content.id, {
    name: 'Icon',
    width: 24,
    height: 24,
    cornerRadius: 4,
    fills: [{ type: 'SOLID', color: { r: 0.1, g: 0.4, b: 0.8, a: 1 }, opacity: 1, visible: true }]
  })
  computeAllLayouts(graph, library.id)
  const screen = graph.createNode('FRAME', parentId, {
    name: 'Camera settings',
    x: 40,
    y: 40,
    width: 320,
    layoutMode: 'VERTICAL',
    primaryAxisSizing: 'HUG',
    counterAxisSizing: 'FIXED',
    itemSpacing: 12,
    clipsContent: true
  })
  for (const name of ['First', 'Second']) {
    const instance = graph.createInstance(main.id, screen.id, { name })
    if (!instance) throw new Error('Settings instance missing')
    graph.updateNode(instance.id, { layoutAlignSelf: 'STRETCH' })
  }
  return { screenId: screen.id, componentId: main.id }
}

export async function createSavedResizingFrameScene(graph: SceneGraph, parentId: string) {
  const screen = await renderTree(
    graph,
    Frame({
      name: 'Camera Settings',
      flex: 'col',
      w: 320,
      h: 'hug',
      children: Frame({
        name: 'Top Bar',
        flex: 'col',
        w: 'fill',
        h: 'hug',
        p: 16,
        bg: '#20252B',
        children: Text({
          name: 'Heading',
          children: 'Camera Settings',
          font: 'Inter',
          size: 18,
          color: '#FFFFFF'
        })
      })
    }),
    { parentId, x: 40, y: 40 }
  )
  const bar = graph.getChildren(screen.id)[0]
  if (!bar) throw new Error('Top Bar missing')
  graph.updateNode(bar.id, { counterAxisSizing: 'HUG' })
  computeAllLayouts(graph, parentId)
  await initCodec()
  return exportFigFile(graph)
}
