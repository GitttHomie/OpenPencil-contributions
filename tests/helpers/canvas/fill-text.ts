import type { Page } from '@playwright/test'

export async function createFillTextWrapScene(page: Page) {
  return page.evaluate(async () => {
    const editor = window.openPencil?.getStore?.()
    if (!editor) throw new Error('Editor unavailable')
    const graph = editor.graph
    const component = graph.createNode('COMPONENT', editor.state.currentPageId, {
      name: 'Fill text component',
      x: 40,
      y: 60,
      width: 269,
      layoutMode: 'VERTICAL',
      primaryAxisSizing: 'HUG',
      counterAxisSizing: 'FIXED',
      paddingTop: 12,
      paddingBottom: 12,
      fills: [{ type: 'SOLID', color: { r: 1, g: 1, b: 1, a: 1 }, opacity: 1, visible: true }]
    })
    const label = graph.createNode('TEXT', component.id, {
      name: 'Label',
      text: 'A sentence long enough that it has to wrap automatically when the frame gets narrower.',
      fontFamily: 'Inter',
      fontSize: 16,
      lineHeight: 24,
      textAutoResize: 'WIDTH_AND_HEIGHT',
      layoutAlignSelf: 'STRETCH',
      fills: [{ type: 'SOLID', color: { r: 0.1, g: 0.1, b: 0.1, a: 1 }, opacity: 1, visible: true }]
    })
    const instance = graph.createInstance(component.id, editor.state.currentPageId, {
      name: 'Narrow instance',
      x: 350,
      y: 60
    })
    if (!instance) throw new Error('Missing instance')
    const copy = graph.getChildren(instance.id)[0]
    if (!copy) throw new Error('Missing instance label')
    await editor.loadFontsForNodes([component.id, instance.id])
    editor.updateNodeWithUndo(instance.id, { width: 160 })
    editor.runLayoutForNode(component.id)
    editor.runLayoutForNode(instance.id)
    editor.zoomTo100()
    editor.pan(-editor.state.panX, -editor.state.panY)
    editor.select([label.id, copy.id])
    editor.requestRender()
    return [label, copy].map((node) => ({
      width: node.width,
      height: node.height,
      autoResize: node.textAutoResize
    }))
  })
}
