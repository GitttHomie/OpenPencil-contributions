import type { Page } from '@playwright/test'

export function seedVariantPropertyScene(page: Page, count = 1, withProperties = true) {
  return page.evaluate(
    ({ count, withProperties }) => {
      const editor = window.openPencil?.getStore?.()
      if (!editor) throw new Error('Editor unavailable')
      const pageId = editor.state.currentPageId
      const component = editor.graph.createNode('COMPONENT', pageId, {
        name: 'Button',
        x: 100,
        y: 150,
        width: 120,
        height: 40
      })
      const label = editor.graph.createNode('TEXT', component.id, {
        name: 'Label',
        text: 'Button',
        fontSize: 16
      })
      const propertyId = withProperties
        ? editor.exposeComponentProperty(label.id, 'TEXT', 'Label')
        : undefined
      const instance = editor.graph.createInstance(component.id, pageId, {
        name: 'Button instance',
        x: 100,
        y: 300
      })
      if ((withProperties && !propertyId) || !instance) throw new Error('Missing fixture')
      for (let index = 1; index < count; index++) editor.addVariant(component.id)
      editor.select([count === 1 ? component.id : (component.parentId ?? component.id)])
      editor.requestRender()
      return { componentId: component.id, instanceId: instance.id, propertyId }
    },
    { count, withProperties }
  )
}

export function readVariantPropertyScene(page: Page) {
  return page.evaluate(() => {
    const editor = window.openPencil?.getStore?.()
    if (!editor) throw new Error('Editor unavailable')
    const roots = editor.graph.getChildren(editor.state.currentPageId)
    const set = roots.find((node) => node.type === 'COMPONENT_SET' && node.name === 'Button')
    const instance = roots.find(
      (node) => node.type === 'INSTANCE' && node.name === 'Button instance'
    )
    const property = set?.componentPropertyDefinitions.find(
      (definition) => definition.name === 'Label'
    )
    return {
      set: set ? { id: set.id, layoutMode: set.layoutMode, width: set.width } : null,
      variants: set
        ? editor.graph.getChildren(set.id).map((variant) => ({
            id: variant.id,
            name: variant.name,
            text: editor.graph.getChildren(variant.id).find((node) => node.type === 'TEXT')?.text
          }))
        : [],
      propertyId: property?.id,
      properties:
        set?.componentPropertyDefinitions.map((definition) => ({
          id: definition.id,
          name: definition.name,
          type: definition.type,
          values: definition.variantOptions
        })) ?? [],
      instanceId: instance?.id,
      instanceText: instance
        ? editor.graph.getChildren(instance.id).find((node) => node.type === 'TEXT')?.text
        : undefined
    }
  })
}

export async function selectVariantPropertyNode(page: Page, id: string) {
  await page.evaluate((id) => {
    const editor = window.openPencil?.getStore?.()
    if (!editor) throw new Error('Editor unavailable')
    editor.select([id])
  }, id)
}
