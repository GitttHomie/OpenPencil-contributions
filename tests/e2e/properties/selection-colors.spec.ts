import { expect, test, useEditorSetupWithClear } from '#tests/e2e/fixtures'

const editor = useEditorSetupWithClear('/?test&no-rulers')

test('canvas clicks immediately show the selected frame palette, including switching frames', async () => {
  await editor.page.evaluate(() => {
    const store = window.openPencil.getStore()
    for (const [x, color] of [
      [80, { r: 1, g: 0, b: 0, a: 1 }],
      [380, { r: 0, g: 0, b: 1, a: 1 }]
    ] as const) {
      const frame = store.graph.createNode('FRAME', store.state.currentPageId, {
        x,
        y: 100,
        width: 220,
        height: 200,
        fills: []
      })
      store.graph.createNode('RECTANGLE', frame.id, {
        x: 20,
        y: 20,
        width: 100,
        height: 100,
        fills: [{ type: 'SOLID', color, opacity: 1, visible: true }]
      })
    }
    store.clearSelection()
    store.requestRender()
  })
  const colors = editor.page.getByTestId('selection-colors')
  await editor.canvas.click(120, 140)
  await expect(colors.getByRole('textbox', { name: 'Selection colors' })).toHaveValue('FF0000')
  await editor.canvas.click(420, 140)
  await expect(colors.getByRole('textbox', { name: 'Selection colors' })).toHaveValue('0000FF')
  await editor.canvas.click(120, 140)
  await expect(colors.getByRole('textbox', { name: 'Selection colors' })).toHaveValue('FF0000')
})
