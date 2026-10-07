import type { Page } from '@playwright/test'

export async function seedSpacingToken(page: Page) {
  return page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('Editor unavailable')
    const collection = store.graph.createCollection('Spacing')
    const variable = store.graph.createVariable('gutter', 'FLOAT', collection.id, 24)
    variable.scopes = ['GAP']
    const frame = store.graph.createNode('FRAME', store.state.currentPageId, {
      width: 100,
      height: 40,
      layoutMode: 'HORIZONTAL',
      boundVariables: { paddingLeft: variable.id }
    })
    store.updateVariableValue(variable.id, collection.defaultModeId, 24)
    store.clearSelection()
    return { variableId: variable.id, frameId: frame.id, modeId: collection.defaultModeId }
  })
}

export async function tokenCanvasValue(page: Page, frameId: string) {
  return page.evaluate(
    (id) => window.openPencil?.getStore?.().graph.getNode(id)?.paddingLeft,
    frameId
  )
}
