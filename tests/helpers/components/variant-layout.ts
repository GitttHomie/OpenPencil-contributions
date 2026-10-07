import type { Page } from '@playwright/test'

import type { SceneNode } from '@open-pencil/scene-graph'

import { CanvasHelper } from '#tests/helpers/canvas'

export async function createVariantLayoutScene(page: Page) {
  await page.goto('/?test&no-rulers')
  const canvas = new CanvasHelper(page)
  await canvas.waitForInit()
  const ids = await page.evaluate(async () => {
    const editor = window.openPencil?.getStore?.()
    if (!editor) throw new Error('Editor unavailable')
    const componentSet = editor.graph.createNode('COMPONENT_SET', editor.state.currentPageId, {
      name: 'Button',
      x: 2000,
      componentPropertyDefinitions: [
        {
          id: 'variant:size',
          name: 'Size',
          type: 'VARIANT',
          defaultValue: 'Small',
          variantOptions: ['Small', 'Large']
        }
      ]
    })
    const small = editor.graph.createNode('COMPONENT', componentSet.id, {
      name: 'Size=Small',
      width: 80,
      height: 32,
      componentPropertyValues: { Size: 'Small' },
      cornerRadius: 8,
      fills: [{ type: 'SOLID', color: { r: 0.1, g: 0.3, b: 0.8, a: 1 }, opacity: 1, visible: true }]
    })
    editor.graph.createNode('COMPONENT', componentSet.id, {
      name: 'Size=Large',
      x: 200,
      width: 160,
      height: 64,
      componentPropertyValues: { Size: 'Large' },
      cornerRadius: 8,
      fills: [{ type: 'SOLID', color: { r: 0.1, g: 0.3, b: 0.8, a: 1 }, opacity: 1, visible: true }]
    })
    const parent = editor.graph.createNode('FRAME', editor.state.currentPageId, {
      name: 'Buttons',
      x: 60,
      y: 100,
      layoutMode: 'HORIZONTAL',
      primaryAxisSizing: 'HUG',
      counterAxisSizing: 'HUG',
      itemSpacing: 12,
      paddingLeft: 8,
      paddingRight: 8,
      paddingTop: 8,
      paddingBottom: 8,
      fills: [{ type: 'SOLID', color: { r: 1, g: 1, b: 1, a: 1 }, opacity: 1, visible: true }]
    })
    const first = editor.graph.createInstance(small.id, parent.id)
    const second = editor.graph.createInstance(small.id, parent.id)
    if (!first || !second) throw new Error('Expected instances')
    await Promise.resolve()
    editor.runLayoutForNode(parent.id)
    editor.select([first.id])
    return { parent: parent.id, first: first.id, second: second.id }
  })
  return {
    canvas,
    read: () =>
      page.evaluate((ids) => {
        const editor = window.openPencil?.getStore?.()
        if (!editor) throw new Error('Editor unavailable')
        const bounds = (id: string): Pick<SceneNode, 'x' | 'y' | 'width' | 'height'> => {
          const node = editor.graph.getNode(id)
          if (!node) throw new Error('Missing variant layout node')
          return { x: node.x, y: node.y, width: node.width, height: node.height }
        }
        return { parent: bounds(ids.parent), first: bounds(ids.first), second: bounds(ids.second) }
      }, ids)
  }
}
