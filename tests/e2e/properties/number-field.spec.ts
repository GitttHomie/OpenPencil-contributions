import { expect, test, useEditorSetup } from '#tests/e2e/fixtures'
import { expectDefined } from '#tests/helpers/assert'
import { propertyField } from '#tests/helpers/properties'
import { activeTool, removeInspectedSelection } from '#tests/helpers/properties/number-field'
import { getSelectedNode } from '#tests/helpers/store'

const editor = useEditorSetup()

function xField() {
  return propertyField(editor.page, 'x')
}

async function editField(field: ReturnType<typeof xField>) {
  await field.click()
  return field.getByRole('spinbutton', { name: 'X Axis' })
}

async function numericFieldValue(field: ReturnType<typeof xField>): Promise<number> {
  return Number(expectDefined(await field.getAttribute('aria-valuenow'), 'field value'))
}

test.beforeEach(async () => {
  await editor.canvas.clearCanvas()
  await editor.canvas.drawRect(120, 100, 80, 80)
})

test('NumberField commits arithmetic and relative expressions', async () => {
  const field = xField()
  const before = await numericFieldValue(field)

  let input = await editField(field)
  await expect(field).not.toHaveAttribute('role')
  await expect(input).toHaveAttribute('role', 'spinbutton')
  await expect(input).toHaveAttribute('aria-label', 'X Axis')
  await expect(field.getByRole('spinbutton')).toHaveCount(1)
  await input.fill('*2')
  await input.press('Enter')
  await editor.canvas.waitForRender()
  expect((await getSelectedNode(editor.page))?.x).toBe(before * 2)

  input = await editField(field)
  await input.fill('+10')
  await input.press('Enter')
  await editor.canvas.waitForRender()
  expect((await getSelectedNode(editor.page))?.x).toBe(before * 2 + 10)
  await expect(field).toHaveAttribute('aria-valuenow', String(before * 2 + 10))
  editor.canvas.assertNoErrors()
})

test('NumberField invalid input and Escape restore the previous value', async () => {
  const field = xField()
  // Cancellation restores the exact graph coordinate, not its rounded display value.
  const before = expectDefined((await getSelectedNode(editor.page))?.x, 'original x')

  let input = await editField(field)
  await input.fill('77')
  await editor.canvas.waitForRender()
  expect((await getSelectedNode(editor.page))?.x).toBe(77)
  await input.press('Escape')
  await editor.canvas.waitForRender()
  expect((await getSelectedNode(editor.page))?.x).toBe(before)

  input = await editField(field)
  await input.fill('constructor')
  await input.press('Enter')
  await editor.canvas.waitForRender()
  expect((await getSelectedNode(editor.page))?.x).toBe(before)
  await expect(field).not.toHaveAttribute('data-editing')
  editor.canvas.assertNoErrors()
})

test('NumberField Arrow keys honor Shift and Alt multipliers', async () => {
  const field = xField()
  const before = await numericFieldValue(field)
  const input = await editField(field)

  await input.press('ArrowUp')
  await input.press('Shift+ArrowUp')
  await input.press('Alt+ArrowDown')
  await input.press('Enter')
  await editor.canvas.waitForRender()

  expect((await getSelectedNode(editor.page))?.x).toBe(before + 10.9)
  editor.canvas.assertNoErrors()
})

test('focusing negative tracking preserves its exact value, binding, and undo history', async () => {
  const initial = -0.9599999785423279
  const original = await editor.page.evaluate((letterSpacing) => {
    const store = window.openPencil.getStore()
    const collection = store.graph.createCollection('Tracking')
    const variable = store.graph.createVariable(
      'Display tracking',
      'FLOAT',
      collection.id,
      letterSpacing
    )
    const text = store.graph.createNode('TEXT', store.state.currentPageId, {
      text: 'Display',
      letterSpacing,
      boundVariables: { letterSpacing: variable.id }
    })
    store.select([text.id])
    store.undo.clear()
    store.requestRender()
    return { id: text.id, variableId: variable.id }
  }, initial)
  const field = propertyField(editor.page, 'letterSpacing')
  for (let attempt = 0; attempt < 3; attempt++) {
    await field.click()
    const input = field.locator('input')
    await expect(input).toHaveValue('-0.96')
    if (attempt === 1) await input.press('Tab')
    else await input.press('Enter')
    expect(
      await editor.page.evaluate(({ id, variableId }) => {
        const store = window.openPencil.getStore()
        const node = store.graph.getNode(id)
        return {
          value: node?.letterSpacing,
          binding: node?.boundVariables.letterSpacing,
          variable: store.graph.resolveVariable(variableId),
          undo: store.undo.canUndo
        }
      }, original)
    ).toEqual({ value: initial, binding: original.variableId, variable: initial, undo: false })
  }
})

test('rounded numeric drafts preserve stored precision until edited', async () => {
  const initial = 120.123456789
  await editor.page.evaluate((x) => {
    const store = window.openPencil.getStore()
    store.updateNodeWithUndo(store.getSelectedNodes()[0].id, { x })
    store.undo.clear()
  }, initial)
  const field = xField()
  await expect(field).toContainText('120.12')
  for (const key of ['Enter', 'Tab', 'Escape']) {
    const input = await editField(field)
    await expect(input).toHaveValue('120.12')
    await input.press(key)
    expect((await getSelectedNode(editor.page))?.x).toBe(initial)
    expect(await editor.page.evaluate(() => window.openPencil.getStore().undo.canUndo)).toBe(false)
  }
  const input = await editField(field)
  await input.fill('125.123456')
  await expect(input).toHaveValue('125.123456')
  await input.press('Enter')
  expect((await getSelectedNode(editor.page))?.x).toBe(125.123456)
  await editor.page.evaluate(() => window.openPencil.getStore().undoAction())
  expect((await getSelectedNode(editor.page))?.x).toBe(initial)
})

test('stepping a negative value uses the displayed number without reapplying subtraction', async () => {
  await editor.page.evaluate(() => {
    const store = window.openPencil.getStore()
    store.updateNodeWithUndo(store.getSelectedNodes()[0].id, { x: -10 })
  })
  const input = await editField(xField())
  await input.press('ArrowUp')
  await input.press('ArrowUp')
  await input.press('Enter')
  expect((await getSelectedNode(editor.page))?.x).toBe(-8)
})

test('mixed numeric edits cancel per-node values and commit zero in one undo step', async () => {
  await editor.canvas.drawRect(300, 100, 80, 80)
  await editor.canvas.selectAll()
  const values = () =>
    editor.page.evaluate(() =>
      window.openPencil
        ?.getStore?.()
        .getSelectedNodes()
        .map((node) => node.x)
    )
  const original = await values()
  let input = await editField(xField())
  await input.fill('77')
  expect(await values()).toEqual([77, 77])
  await input.press('Escape')
  expect(await values()).toEqual(original)
  input = await editField(xField())
  await input.fill('0')
  await input.press('Enter')
  expect(await values()).toEqual([0, 0])
  await editor.page.evaluate(() => window.openPencil?.getStore?.().undoAction())
  expect(await values()).toEqual(original)
})

test('NumberField exposes mixed state through canonical data attributes', async () => {
  await editor.canvas.drawRect(300, 100, 80, 80)
  await editor.canvas.selectAll()
  await editor.canvas.waitForRender()

  await expect(xField()).toHaveAttribute('data-mixed')
  await expect(xField()).not.toHaveAttribute('aria-valuenow')
  editor.canvas.assertNoErrors()
})

test('removing a focused numeric field leaves canvas shortcuts available', async () => {
  const input = await editField(xField())
  await input.fill('77')
  await removeInspectedSelection(editor.page)
  await expect(input).toBeHidden()
  await editor.canvas.click(450, 350)
  await editor.page.keyboard.press('r')
  await expect.poll(() => activeTool(editor.page)).toBe('RECTANGLE')
  await editor.page.keyboard.press('v')
  await expect.poll(() => activeTool(editor.page)).toBe('SELECT')
  editor.canvas.assertNoErrors()
})
