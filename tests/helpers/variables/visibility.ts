import type { Page } from '@playwright/test'

import { CanvasHelper } from '#tests/helpers/canvas'

export async function visibilityScene(page: Page) {
  await page.goto('/?test')
  const canvas = new CanvasHelper(page)
  await canvas.waitForInit()
  const ids = await page.evaluate(() => {
    const editor = window.openPencil?.getStore?.()
    if (!editor) throw new Error('Editor unavailable')
    const graph = editor.graph
    const collection = graph.createCollection('Visibility')
    const hidden = graph.createVariable('Hide content', 'BOOLEAN', collection.id, false)
    graph.createVariable('Show content', 'BOOLEAN', collection.id, true)
    graph.createVariable('Not a Boolean', 'FLOAT', collection.id, 4)
    const frame = graph.createNode('FRAME', editor.state.currentPageId, {
      name: 'Frame',
      width: 100,
      height: 40
    })
    const text = graph.createNode('TEXT', editor.state.currentPageId, {
      name: 'Text',
      text: 'Hello',
      x: 150
    })
    const main = graph.createNode('COMPONENT', editor.state.currentPageId, {
      name: 'Control',
      x: 250,
      width: 100,
      height: 40
    })
    const nested = graph.createNode('FRAME', main.id, { name: 'Nested', width: 30, height: 30 })
    const property = editor.exposeComponentProperty(nested.id, 'VISIBLE', 'Show nested')
    const first = graph.createInstance(main.id, editor.state.currentPageId)
    const second = graph.createInstance(main.id, editor.state.currentPageId)
    if (!first || !second || !property) throw new Error('Missing components')
    editor.select([frame.id, text.id])
    return {
      frame: frame.id,
      text: text.id,
      main: main.id,
      nested: nested.id,
      first: first.id,
      second: second.id,
      firstChild: graph.getChildren(first.id)[0].id,
      secondChild: graph.getChildren(second.id)[0].id,
      hidden: hidden.id,
      property
    }
  })
  return {
    ids,
    canvas,
    select: (ids: string[]) =>
      page.evaluate((ids) => window.openPencil?.getStore?.().select(ids), ids),
    read: (ids: string[]) =>
      page.evaluate((ids) => {
        const editor = window.openPencil?.getStore?.()
        if (!editor) throw new Error('Editor unavailable')
        return ids.map((id) => {
          const node = editor.graph.getNode(id)
          if (!node) throw new Error('Missing node')
          return {
            visible: node.visible,
            variable: node.boundVariables.visible ?? null,
            references: node.componentPropertyReferences
          }
        })
      }, ids)
  }
}

export async function forwardedVisibilityScene(page: Page) {
  const scene = await visibilityScene(page)
  const forwarded = await page.evaluate((ids) => {
    const editor = window.openPencil?.getStore?.()
    if (!editor) throw new Error('Editor unavailable')
    const graph = editor.graph
    const component = graph.createNode('COMPONENT', editor.state.currentPageId, { name: 'Details' })
    const label = graph.createNode('TEXT', component.id, { name: 'Caption', text: 'Details' })
    const icon = graph.createNode('FRAME', component.id, { name: 'Icon', width: 20, height: 20 })
    const property = editor.exposeComponentProperty(label.id, 'VISIBLE', 'Show details')
    if (!property) throw new Error('Missing property')
    editor.bindComponentProperty(icon.id, 'VISIBLE', property)
    const nested = graph.createInstance(component.id, ids.main)
    if (!nested) throw new Error('Missing nested instance')
    editor.setNestedComponentPropertyExposure(ids.main, nested.id, [property])
    graph.syncInstances(ids.main)
    const forwarded = editor
      .getInstanceComponentPropertyDefinitions(ids.first)
      .find((d) => d.name.endsWith('Show details'))
    if (!forwarded) throw new Error('Missing forwarded property')
    const first = editor.getInstanceComponentPropertyTarget(ids.first, forwarded.id)
    const second = editor.getInstanceComponentPropertyTarget(ids.second, forwarded.id)
    if (!first || !second) throw new Error('Missing forwarded targets')
    editor.requestRender()
    return {
      name: forwarded.name,
      firstTargets: graph.getChildren(first.instance.id).map((n) => n.id),
      secondTargets: graph.getChildren(second.instance.id).map((n) => n.id),
      sources: [label.id, icon.id]
    }
  }, scene.ids)
  return { ...scene, forwarded }
}
