import { expect, test, type Page } from '@playwright/test'

import { forwardedVisibilityScene, visibilityScene } from '#tests/helpers/variables/visibility'

async function pick(page: Page, name = 'Visibility variable') {
  await page.getByRole('button', { name, exact: true }).click()
  const option = page
    .getByRole('option')
    .filter({ has: page.getByText('Hide content', { exact: true }) })
  await expect(option).toContainText('false')
  await expect(page.getByRole('option').filter({ hasText: 'Not a Boolean' })).toHaveCount(0)
  await option.click()
}

test('mixed frame/text selection binds, previews, detaches and undoes visibility', async ({
  page
}) => {
  const scene = await visibilityScene(page)
  const toggle = page
    .getByRole('region', { name: 'Appearance', exact: true })
    .getByRole('switch', { name: 'Visibility', exact: true })
  await expect(toggle).toBeChecked()
  await pick(page)
  expect((await scene.read([scene.ids.frame, scene.ids.text])).map((n) => n.visible)).toEqual([
    false,
    false
  ])
  await expect(toggle).toBeDisabled()
  await expect(toggle).not.toBeChecked()
  await expect(page.locator('[data-property="visibility"] [data-slot="pill"]')).toContainText(
    'Hide content'
  )
  await page.getByRole('button', { name: 'Visibility variable', exact: true }).click()
  await page.getByRole('button', { name: 'Detach variable', exact: true }).click()
  await expect(toggle).toBeEnabled()
  expect((await scene.read([scene.ids.frame, scene.ids.text])).map((n) => n.variable)).toEqual([
    null,
    null
  ])
  await toggle.click()
  expect((await scene.read([scene.ids.frame, scene.ids.text])).map((n) => n.visible)).toEqual([
    true,
    true
  ])
  await scene.canvas.pressKey('Meta+z')
  expect((await scene.read([scene.ids.frame, scene.ids.text])).map((n) => n.visible)).toEqual([
    false,
    false
  ])
  scene.canvas.assertNoErrors()
})

test('an exposed instance visibility toggle binds its nested layer and reflects the resolved value', async ({
  page
}) => {
  const scene = await visibilityScene(page)
  await scene.select([scene.ids.first])
  const section = page.getByRole('region', { name: 'Component properties', exact: true })
  const toggle = section.getByRole('switch', { name: 'Show nested', exact: true })
  await pick(page, 'Show nested: Visibility variable')
  await expect(toggle).not.toBeChecked()
  await expect(toggle).toBeDisabled()
  expect(
    (
      await scene.read([
        scene.ids.nested,
        scene.ids.first,
        scene.ids.firstChild,
        scene.ids.secondChild
      ])
    ).map((n) => n.visible)
  ).toEqual([true, true, false, true])
  expect((await scene.read([scene.ids.firstChild]))[0].references).toHaveLength(1)
  await section.screenshot({ path: test.info().outputPath('exposed-visibility.png') })
  await section
    .getByRole('button', { name: 'Show nested: Visibility variable', exact: true })
    .click()
  await page.getByRole('button', { name: 'Detach variable', exact: true }).click()
  await expect(toggle).not.toBeChecked()
  await expect(toggle).toBeEnabled()
  await scene.canvas.undo()
  await expect(toggle).not.toBeChecked()
  await expect(toggle).toBeDisabled()
  await scene.canvas.undo()
  await expect(toggle).toBeChecked()
  await expect(toggle).toBeEnabled()
  scene.canvas.assertNoErrors()
})

test('exposed visibility binds across selected instances without changing the definition', async ({
  page
}) => {
  const scene = await visibilityScene(page)
  await scene.select([scene.ids.first, scene.ids.second])
  await pick(page, 'Show nested: Visibility variable')
  expect(
    (await scene.read([scene.ids.nested, scene.ids.firstChild, scene.ids.secondChild])).map(
      (n) => n.visible
    )
  ).toEqual([true, false, false])
  await scene.canvas.undo()
  expect(
    (await scene.read([scene.ids.firstChild, scene.ids.secondChild])).map((n) => n.variable)
  ).toEqual([null, null])
  scene.canvas.assertNoErrors()
})

test('a forwarded Boolean property binds every linked layer inside its nested instance', async ({
  page
}) => {
  const scene = await forwardedVisibilityScene(page)
  await scene.select([scene.ids.first])
  await pick(page, `${scene.forwarded.name}: Visibility variable`)
  expect((await scene.read(scene.forwarded.firstTargets)).map((n) => n.visible)).toEqual([
    false,
    false
  ])
  expect((await scene.read(scene.forwarded.secondTargets)).map((n) => n.visible)).toEqual([
    true,
    true
  ])
  expect((await scene.read(scene.forwarded.sources)).map((n) => n.variable)).toEqual([null, null])
  const toggle = page
    .getByRole('region', { name: 'Component properties', exact: true })
    .getByRole('switch', { name: scene.forwarded.name, exact: true })
  await expect(toggle).not.toBeChecked()
  await expect(toggle).toBeDisabled()
  await scene.canvas.undo()
  await expect(toggle).toBeChecked()
  scene.canvas.assertNoErrors()
})

test('replacing a nested instance property requires confirmation and changes only that instance', async ({
  page
}) => {
  const scene = await visibilityScene(page)
  await scene.select([scene.ids.firstChild])
  await pick(page)
  const dialog = page.getByRole('alertdialog')
  await expect(dialog).toBeVisible()
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click()
  expect((await scene.read([scene.ids.firstChild]))[0].visible).toBe(true)
  await pick(page)
  await dialog.getByRole('button', { name: 'Apply variable', exact: true }).click()
  expect(
    (await scene.read([scene.ids.nested, scene.ids.firstChild, scene.ids.secondChild])).map(
      (n) => n.visible
    )
  ).toEqual([true, false, true])
  await scene.canvas.pressKey('Meta+z')
  expect((await scene.read([scene.ids.firstChild]))[0].visible).toBe(true)
  await scene.select([scene.ids.nested])
  await pick(page)
  await dialog.getByRole('button', { name: 'Apply variable', exact: true }).click()
  expect(
    (await scene.read([scene.ids.nested, scene.ids.firstChild, scene.ids.secondChild])).map(
      (n) => n.visible
    )
  ).toEqual([false, false, false])
  expect((await scene.read([scene.ids.nested]))[0].references).toEqual([])
  await scene.canvas.pressKey('Meta+z')
  expect((await scene.read([scene.ids.nested]))[0].references).toHaveLength(1)
  scene.canvas.assertNoErrors()
})

test('an entire component instance can use a visibility variable', async ({ page }) => {
  const scene = await visibilityScene(page)
  await scene.select([scene.ids.first])
  await pick(page)
  expect(
    (await scene.read([scene.ids.main, scene.ids.first, scene.ids.second])).map((n) => n.visible)
  ).toEqual([true, false, true])
  scene.canvas.assertNoErrors()
})

test('component defaults expose a variable picker and instances can detach and reset inheritance', async ({
  page
}) => {
  const scene = await visibilityScene(page)
  await scene.select([scene.ids.main])
  const section = page.getByRole('region', { name: 'Component properties', exact: true })
  await section
    .getByRole('button', { name: 'Component properties: Show nested', exact: true })
    .click()
  await pick(page, 'Default value: Visibility variable')
  const toggle = section.getByRole('switch', { name: 'Default value', exact: true })
  await expect(toggle).not.toBeChecked()
  await expect(toggle).toBeDisabled()
  expect(
    (await scene.read([scene.ids.nested, scene.ids.firstChild, scene.ids.secondChild])).map(
      (node) => node.visible
    )
  ).toEqual([false, false, false])
  await section.screenshot({ path: test.info().outputPath('default-visibility-variable.png') })
  await scene.select([scene.ids.first])
  const instanceToggle = section.getByRole('switch', { name: 'Show nested', exact: true })
  await expect(instanceToggle).toBeDisabled()
  await page.getByRole('button', { name: 'Show nested: Visibility variable', exact: true }).click()
  await page.getByRole('button', { name: 'Detach variable', exact: true }).click()
  await expect(instanceToggle).toBeEnabled()
  await page.evaluate((id) => {
    const editor = window.openPencil?.getStore?.()
    const variable = editor?.graph.variables.get(id)
    const collection = variable && editor?.graph.variableCollections.get(variable.collectionId)
    if (editor && variable && collection)
      editor.updateVariableValue(id, collection.defaultModeId, true)
  }, scene.ids.hidden)
  await expect(instanceToggle).not.toBeChecked()
  await page.getByRole('button', { name: 'Use shared default: Show nested', exact: true }).click()
  await expect(instanceToggle).toBeChecked()
  await expect(instanceToggle).toBeDisabled()
  scene.canvas.assertNoErrors()
})

test('a forwarded nested property accepts a variable default in the containing component', async ({
  page
}) => {
  const scene = await forwardedVisibilityScene(page)
  await scene.select([scene.ids.main])
  const section = page.getByRole('region', { name: 'Component properties', exact: true })
  await section
    .getByRole('button', { name: 'Component properties: Show details', exact: true })
    .click()
  await pick(page, 'Default value: Visibility variable')
  expect((await scene.read(scene.forwarded.firstTargets)).map((node) => node.visible)).toEqual([
    false,
    false
  ])
  expect((await scene.read(scene.forwarded.secondTargets)).map((node) => node.visible)).toEqual([
    false,
    false
  ])
  expect((await scene.read(scene.forwarded.sources)).map((node) => node.visible)).toEqual([
    true,
    true
  ])
  await scene.canvas.undo()
  expect((await scene.read(scene.forwarded.firstTargets)).map((node) => node.visible)).toEqual([
    true,
    true
  ])
  scene.canvas.assertNoErrors()
})
