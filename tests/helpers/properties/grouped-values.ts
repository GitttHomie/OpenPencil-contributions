import type { Page } from '@playwright/test'

import { CanvasHelper } from '#tests/helpers/canvas'

export async function createGroupedValuesScene(page: Page, grid = false) {
  await page.goto('/?test&no-rulers')
  const canvas = new CanvasHelper(page)
  await canvas.waitForInit()
  const fixture = await page.evaluate((grid) => {
    const editor = window.openPencil?.getStore?.()
    if (!editor) throw new Error('Editor unavailable')
    const collection = editor.graph.createCollection('Sizes')
    const variable = editor.graph.createVariable('Size/medium', 'FLOAT', collection.id, 16)
    const other = editor.graph.createVariable('Size/other', 'FLOAT', collection.id, 16)
    const node = editor.graph.createNode('FRAME', editor.state.currentPageId, {
      name: 'Grouped values',
      x: 100,
      y: 100,
      width: 240,
      height: 160,
      layoutMode: grid ? 'GRID' : 'HORIZONTAL',
      paddingLeft: 16,
      paddingRight: 16,
      paddingTop: 16,
      paddingBottom: 16,
      cornerRadius: 16,
      strokes: [
        { weight: 2, align: 'INSIDE', visible: true, opacity: 1, color: { r: 0, g: 0, b: 0, a: 1 } }
      ]
    })
    editor.graph.bindVariable(node.id, 'cornerRadius', variable.id)
    editor.select([node.id])
    editor.requestRender()
    return { nodeId: node.id, variableId: variable.id, otherId: other.id }
  }, grid)
  return {
    canvas,
    ...fixture,
    async read() {
      return page.evaluate(({ nodeId }) => {
        const editor = window.openPencil?.getStore?.()
        const node = editor?.graph.getNode(nodeId)
        if (!editor || !node) throw new Error('Missing grouped values fixture')
        return {
          padding: [node.paddingLeft, node.paddingRight, node.paddingTop, node.paddingBottom],
          corners: [
            node.topLeftRadius,
            node.topRightRadius,
            node.bottomRightRadius,
            node.bottomLeftRadius
          ],
          border: [
            node.borderTopWeight,
            node.borderRightWeight,
            node.borderBottomWeight,
            node.borderLeftWeight
          ],
          cornerRadius: node.cornerRadius,
          independentCorners: node.independentCorners,
          independentStrokeWeights: node.independentStrokeWeights,
          bindings: node.boundVariables,
          variables: [...editor.graph.variables.values()].map((v) => ({ id: v.id, name: v.name })),
          canUndo: editor.undo.canUndo
        }
      }, fixture)
    }
  }
}
