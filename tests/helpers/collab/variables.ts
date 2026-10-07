import type { Page } from '@playwright/test'

import type { Color } from '@open-pencil/scene-graph'

export async function seedVariableScene(page: Page) {
  return page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('Editor unavailable')
    const collection = store.graph.createCollection('Room foundation')
    store.graph.addMode(collection.id, 'dark', 'Dark')
    const color = store.graph.createVariable('Surface', 'COLOR', collection.id, {
      r: 0.1,
      g: 0.6,
      b: 0.3,
      a: 1
    })
    const alias = store.graph.createVariable('Card surface', 'COLOR', collection.id, {
      aliasId: color.id
    })
    const space = store.graph.createVariable('Padding', 'FLOAT', collection.id, 8)
    space.valuesByMode.dark = 32
    const frame = store.graph.createNode('FRAME', store.state.currentPageId, {
      name: 'Shared variable card',
      x: 100,
      y: 100,
      layoutMode: 'HORIZONTAL',
      primaryAxisSizing: 'HUG',
      counterAxisSizing: 'HUG',
      paddingRight: 8,
      paddingTop: 8,
      paddingBottom: 8,
      cornerRadius: 8,
      fills: [{ type: 'SOLID', color: { r: 0.1, g: 0.6, b: 0.3, a: 1 }, opacity: 1, visible: true }]
    })
    store.graph.createNode('FRAME', frame.id, {
      name: 'Content',
      width: 80,
      height: 32,
      fills: [{ type: 'SOLID', color: { r: 1, g: 1, b: 1, a: 1 }, opacity: 1, visible: true }]
    })
    store.graph.bindVariable(frame.id, 'paddingLeft', space.id)
    store.graph.bindVariable(frame.id, 'fills/0/color', alias.id)
    store.runLayoutForNode(frame.id)
    store.requestRender()
    return {
      collection: collection.id,
      mode: collection.defaultModeId,
      color: color.id,
      alias: alias.id,
      space: space.id,
      frame: frame.id
    }
  })
}

export type VariableScene = Awaited<ReturnType<typeof seedVariableScene>>

export async function changeSharedColor(page: Page, ids: VariableScene, color: Color) {
  await page.evaluate(
    ({ scene, value }) => {
      window.openPencil?.getStore?.().updateVariableValue(scene.color, scene.mode, value)
    },
    { scene: ids, value: color }
  )
}

export async function readVariableScene(page: Page, ids: VariableScene) {
  return page.evaluate((scene) => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('Editor unavailable')
    const frame = store.graph.getNode(scene.frame)
    return {
      name: store.graph.variables.get(scene.space)?.name,
      padding: frame?.paddingLeft,
      width: frame?.width,
      color: store.graph.resolveColorVariable(scene.alias),
      collectionName: store.graph.variableCollections.get(scene.collection)?.name,
      collectionIds: store.graph.variableCollections.get(scene.collection)?.variableIds ?? [],
      variableCount: store.graph.variables.size
    }
  }, ids)
}

export async function changeSharedPadding(page: Page, ids: VariableScene, value: number) {
  await page.evaluate(
    ({ scene, padding }) => {
      window.openPencil?.getStore?.().updateVariableValue(scene.space, scene.mode, padding)
    },
    { scene: ids, padding: value }
  )
}

export async function renameSharedPadding(page: Page, ids: VariableScene, name: string) {
  await page.evaluate(
    ({ scene, label }) => {
      window.openPencil?.getStore?.().renameVariable(scene.space, label)
    },
    { scene: ids, label: name }
  )
}
