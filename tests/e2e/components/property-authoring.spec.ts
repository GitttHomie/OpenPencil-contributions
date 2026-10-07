import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

import {
  createPropertyAuthoringScene,
  createPropertyLayoutScene,
  saveAndReopenPropertyDocument
} from '#tests/helpers/components/property-authoring'
import { propertySection } from '#tests/helpers/properties'
import { getEditingTextId } from '#tests/helpers/store'

async function createProperty(page: Page, attribute: string, name: string) {
  const section = propertySection(page, 'Expose as component property')
  await section.getByRole('button', { name: `${attribute}: Expose`, exact: true }).click()
  await page.getByRole('menuitem', { name: 'Create property…', exact: true }).click()
  await section.getByRole('textbox', { name: 'Property name', exact: true }).fill(name)
  await section.getByRole('button', { name: 'Create', exact: true }).click()
  await expect(
    section.getByRole('button', { name: `${attribute}: ${name}`, exact: true })
  ).toBeVisible()
}

test('creates text, visibility, and swap definitions with editable defaults and connected objects', async ({
  page
}) => {
  const scene = await createPropertyAuthoringScene(page)
  await scene.select(scene.ids.label)
  const exposure = propertySection(page, 'Expose as component property')
  await expect(exposure.locator('[data-attribute]').first()).toContainText('Visibility')
  await expect(exposure.getByRole('switch')).toHaveCount(1)
  await expect(exposure.getByRole('switch', { name: 'Visibility', exact: true })).toBeChecked()
  await expect(exposure.getByRole('textbox', { name: 'Text content', exact: true })).toHaveValue(
    'Button'
  )
  await createProperty(page, 'Text content', 'Caption')
  await scene.select(scene.ids.badge)
  await createProperty(page, 'Visibility', 'Show badge')
  await scene.select(scene.ids.icon)
  await createProperty(page, 'Nested instance', 'Icon')
  await scene.select(scene.ids.component)
  const manager = propertySection(page, 'Component properties')
  await expect(manager.locator('[data-property]')).toHaveCount(3)
  for (const name of ['Caption', 'Show badge', 'Icon']) {
    await manager
      .getByRole('button', { name: `Component properties: ${name}`, exact: true })
      .click()
  }
  const definitions = (await scene.state()).definitions
  const text = definitions.find((item) => item.name === 'Caption')
  const visibility = definitions.find((item) => item.name === 'Show badge')
  const swap = definitions.find((item) => item.name === 'Icon')
  if (!text || !visibility || !swap) throw new Error('Missing definitions')
  const textRow = manager.locator(`[data-property="${text.id}"]`)
  await expect(textRow.getByRole('button', { name: 'Caption', exact: true })).toHaveText('Caption')
  await textRow.getByRole('textbox', { name: 'Default value', exact: true }).fill('Purchase')
  await textRow.getByRole('textbox', { name: 'Default value', exact: true }).blur()
  await manager
    .locator(`[data-property="${visibility.id}"]`)
    .getByRole('switch', { name: 'Default value', exact: true })
    .click()
  await manager
    .locator(`[data-property="${swap.id}"]`)
    .getByRole('combobox', { name: 'Default value', exact: true })
    .click()
  await page.getByRole('option', { name: 'Icon B', exact: true }).click()
  await expect
    .poll(async () => (await scene.state()).children.find((node) => node.name === 'Caption')?.text)
    .toBe('Purchase')
  await expect
    .poll(async () => (await scene.state()).children.find((node) => node.name === 'Badge')?.visible)
    .toBe(false)
  await expect
    .poll(
      async () =>
        (await scene.state()).definitions.find((item) => item.id === swap.id)?.defaultValue
    )
    .toBe(scene.ids.iconB)
  await manager.screenshot({
    path: test.info().outputPath('property-definitions.png'),
    animations: 'disabled'
  })
  await scene.select(scene.ids.instance)
  const controls = propertySection(page, 'Component properties')
  await controls.getByRole('textbox', { name: 'Caption', exact: true }).fill('Buy now')
  await controls.getByRole('textbox', { name: 'Caption', exact: true }).blur()
  await expect
    .poll(async () => (await scene.state()).children.find((node) => node.name === 'Caption')?.text)
    .toBe('Buy now')
})

test('links compatible properties, preserves overrides, unbinds and reuses an unused definition', async ({
  page
}) => {
  const scene = await createPropertyAuthoringScene(page)
  await scene.select(scene.ids.label)
  await createProperty(page, 'Text content', 'Label')
  await scene.select(scene.ids.badge)
  await createProperty(page, 'Visibility', 'Shown')
  await scene.select(scene.ids.instance)
  await propertySection(page, 'Component properties')
    .getByRole('textbox', { name: 'Label', exact: true })
    .fill('Custom')
  await propertySection(page, 'Component properties')
    .getByRole('textbox', { name: 'Label', exact: true })
    .blur()
  await scene.select(scene.ids.second)
  const exposure = propertySection(page, 'Expose as component property')
  await exposure.getByRole('button', { name: 'Text content: Expose', exact: true }).click()
  await expect(page.getByRole('menuitem', { name: 'Shown', exact: true })).toHaveCount(0)
  await page.getByRole('menuitem', { name: 'Label', exact: true }).click()
  await expect(exposure.getByRole('textbox', { name: 'Text content', exact: true })).toHaveValue(
    'Button'
  )
  await expect
    .poll(async () =>
      (await scene.state()).children
        .filter((node) => node.name === 'Caption' || node.name === 'Second label')
        .map((node) => node.text)
    )
    .toEqual(['Custom', 'Custom'])
  await exposure.getByRole('button', { name: 'Text content: Label', exact: true }).click()
  await page.screenshot({
    path: test.info().outputPath('attribute-linked.png'),
    animations: 'disabled'
  })
  await page.getByRole('menuitem', { name: 'Unbind', exact: true }).click()
  await expect(
    exposure.getByRole('button', { name: 'Text content: Expose', exact: true })
  ).toBeVisible()
  await scene.select(scene.ids.component)
  const manager = propertySection(page, 'Component properties')
  await manager.getByRole('button', { name: 'Component properties: Label', exact: true }).click()
  await manager.getByRole('button', { name: 'Unbind: Caption', exact: true }).click()
  await expect(manager).toContainText('No connected objects.')
  await scene.select(scene.ids.second)
  await exposure.getByRole('button', { name: 'Text content: Expose', exact: true }).click()
  await page.getByRole('menuitem', { name: 'Label', exact: true }).click()
  expect((await scene.state()).definitions).toHaveLength(2)
  await scene.select(scene.ids.component)
  await expect(manager.getByRole('button', { name: 'Second label', exact: true })).toBeVisible()
})

test('renames and deletes definitions with undo while preserving source objects', async ({
  page
}) => {
  const scene = await createPropertyAuthoringScene(page)
  await scene.select(scene.ids.label)
  await createProperty(page, 'Text content', 'Label')
  const originalId = (await scene.state()).definitions[0]?.id
  await scene.select(scene.ids.component)
  const manager = propertySection(page, 'Component properties')
  const name = manager.getByRole('textbox', { name: 'Property name', exact: true })
  await name.fill('Button label')
  await name.press('Enter')
  expect((await scene.state()).definitions[0]?.id).toBe(originalId)
  await name.fill('')
  await name.blur()
  await expect(manager.getByRole('alert')).toBeVisible()
  await name.fill('Button label')
  await name.blur()
  await manager.getByRole('button', { name: 'Delete property', exact: true }).click()
  await expect(manager.locator('[data-property]')).toHaveCount(0)
  await page.getByTestId('canvas-element').focus()
  await scene.canvas.undo()
  await expect(name).toHaveValue('Button label')
  await manager
    .getByRole('button', { name: 'Component properties: Button label', exact: true })
    .click()
  await manager.getByRole('button', { name: 'Caption', exact: true }).click()
  await expect(
    propertySection(page, 'Expose as component property').getByRole('button', {
      name: 'Text content: Button label',
      exact: true
    })
  ).toBeVisible()
})

test('edits unlinked object values and disables linked controls while keeping defaults visible', async ({
  page
}) => {
  const scene = await createPropertyAuthoringScene(page)
  await scene.select(scene.ids.label)
  const exposure = propertySection(page, 'Expose as component property')
  const text = exposure.getByRole('textbox', { name: 'Text content', exact: true })
  const visibility = exposure.getByRole('switch', { name: 'Visibility', exact: true })
  await expect(text).toBeEnabled()
  await text.fill('Fresh label')
  await text.blur()
  await expect
    .poll(async () => (await scene.state()).children.find((node) => node.name === 'Caption')?.text)
    .toBe('Fresh label')
  await visibility.click()
  await expect(visibility).not.toBeChecked()
  await createProperty(page, 'Text content', 'Title')
  await createProperty(page, 'Visibility', 'Show title')
  await expect(text).toBeDisabled()
  await expect(text).toHaveValue('Fresh label')
  await expect(visibility).toBeDisabled()
  await expect(visibility).not.toBeChecked()
  await scene.select(scene.ids.component)
  const definitions = (await scene.state()).definitions
  const titleId = definitions.find((definition) => definition.name === 'Title')?.id
  const visibleId = definitions.find((definition) => definition.name === 'Show title')?.id
  const manager = propertySection(page, 'Component properties')
  for (const name of ['Title', 'Show title']) {
    await manager
      .getByRole('button', { name: `Component properties: ${name}`, exact: true })
      .click()
  }
  const defaultText = manager
    .locator(`[data-property="${titleId}"]`)
    .getByRole('textbox', { name: 'Default value', exact: true })
  await defaultText.fill('Updated default')
  await defaultText.blur()
  await manager
    .locator(`[data-property="${visibleId}"]`)
    .getByRole('switch', { name: 'Default value', exact: true })
    .click()
  await scene.select(scene.ids.label)
  await expect(text).toHaveValue('Updated default')
  await expect(text).toBeDisabled()
  await expect(visibility).toBeChecked()
  await expect(visibility).toBeDisabled()
  await exposure.screenshot({
    path: test.info().outputPath('linked-object-values.png'),
    animations: 'disabled'
  })
  await exposure.getByRole('button', { name: 'Text content: Title', exact: true }).click()
  await page.getByRole('menuitem', { name: 'Unbind', exact: true }).click()
  await expect(text).toBeEnabled()
  await expect(text).toHaveValue('Updated default')
  await exposure.screenshot({
    path: test.info().outputPath('unlinked-object-text.png'),
    animations: 'disabled'
  })
})

test('creates a definition on the component, cancels a draft, and links it from an object', async ({
  page
}) => {
  const scene = await createPropertyAuthoringScene(page)
  await scene.select(scene.ids.component)
  const manager = propertySection(page, 'Component properties')
  await expect(manager).not.toContainText('Manage properties, defaults')
  await manager.getByRole('button', { name: 'Create property…', exact: true }).click()
  await page.getByRole('menuitem', { name: 'New property', exact: true }).click()
  const form = manager.locator('form')
  await form.getByRole('textbox', { name: 'Property name', exact: true }).fill('Draft')
  await form.getByRole('button', { name: 'Cancel', exact: true }).click()
  expect((await scene.state()).definitions).toHaveLength(0)
  await manager.getByRole('button', { name: 'Create property…', exact: true }).click()
  await page.getByRole('menuitem', { name: 'New property', exact: true }).click()
  await form.getByRole('textbox', { name: 'Property name', exact: true }).fill('Shared title')
  await form.getByRole('textbox', { name: 'Default value', exact: true }).fill('Hello')
  await form.getByRole('textbox', { name: 'Default value', exact: true }).blur()
  await form.screenshot({
    path: test.info().outputPath('create-definition.png'),
    animations: 'disabled'
  })
  await form.getByRole('button', { name: 'Create', exact: true }).click()
  const toggle = manager.getByRole('button', {
    name: 'Component properties: Shared title',
    exact: true
  })
  await expect(toggle).toHaveAttribute('aria-expanded', 'false')
  await toggle.click()
  await expect(manager).toContainText('No connected objects.')
  await expect(manager.locator('[data-property]')).toContainText('String')
  await expect(manager.locator('[data-property]')).toContainText('Default value')
  await scene.select(scene.ids.label)
  const exposure = propertySection(page, 'Expose as component property')
  await expect(exposure).not.toContainText('Expose this layer')
  await exposure.getByRole('button', { name: 'Text content: Expose', exact: true }).click()
  await page.getByRole('menuitem', { name: 'Shared title', exact: true }).click()
  await expect(exposure.getByRole('textbox', { name: 'Text content', exact: true })).toHaveValue(
    'Hello'
  )
  await scene.select(scene.ids.component)
  await expect(manager.getByRole('button', { name: 'Caption', exact: true })).toBeVisible()
})

test('creates standalone boolean and swap definitions with selected defaults', async ({ page }) => {
  const scene = await createPropertyAuthoringScene(page)
  await scene.select(scene.ids.component)
  const manager = propertySection(page, 'Component properties')
  for (const kind of ['Boolean', 'Instance swap']) {
    await manager.getByRole('button', { name: 'Create property…', exact: true }).click()
    await page.getByRole('menuitem', { name: 'New property', exact: true }).click()
    const form = manager.locator('form')
    await form.getByRole('textbox', { name: 'Property name', exact: true }).fill(kind)
    await form.getByRole('combobox', { name: 'Property type', exact: true }).click()
    await page.getByRole('option', { name: kind, exact: true }).click()
    if (kind === 'Boolean') {
      await form.getByRole('switch', { name: 'Default value', exact: true }).click()
    } else {
      await form.getByRole('combobox', { name: 'Default value', exact: true }).click()
      await page.getByRole('option', { name: 'Icon B', exact: true }).click()
    }
    await form.getByRole('button', { name: 'Create', exact: true }).click()
    const toggle = manager.getByRole('button', {
      name: `Component properties: ${kind}`,
      exact: true
    })
    await expect(toggle).toHaveAttribute('aria-expanded', 'false')
    await toggle.click()
  }
  const definitions = (await scene.state()).definitions
  expect(definitions.map((definition) => definition.type)).toEqual(['BOOLEAN', 'INSTANCE_SWAP'])
  expect(definitions.map((definition) => definition.defaultValue)).toEqual([
    'true',
    scene.ids.iconB
  ])
  await expect(manager.getByText('No connected objects.', { exact: true })).toHaveCount(2)
})

test('starts properties collapsed and remembers manual expansion across selections', async ({
  page
}) => {
  const scene = await createPropertyAuthoringScene(page)
  await scene.select(scene.ids.label)
  await createProperty(page, 'Text content', 'Label')
  await scene.select(scene.ids.component)
  const manager = propertySection(page, 'Component properties')
  const toggle = manager.getByRole('button', { name: 'Component properties: Label', exact: true })
  const value = manager.getByRole('textbox', { name: 'Default value', exact: true })
  const before = await scene.state()
  await expect(toggle).toHaveAttribute('aria-expanded', 'false')
  await expect(value).toBeHidden()
  await expect(manager.getByRole('button', { name: 'Caption', exact: true })).toBeHidden()
  await expect(manager.getByRole('textbox', { name: 'Property name', exact: true })).toHaveValue(
    'Label'
  )
  await expect(manager.getByRole('button', { name: 'Delete property', exact: true })).toBeVisible()
  await scene.select(scene.ids.label)
  await scene.select(scene.ids.component)
  await expect(toggle).toHaveAttribute('aria-expanded', 'false')
  await toggle.focus()
  await toggle.press('Enter')
  await expect(value).toBeVisible()
  await scene.select(scene.ids.label)
  await scene.select(scene.ids.component)
  await expect(toggle).toHaveAttribute('aria-expanded', 'true')
  await expect(value).toBeVisible()
  await toggle.press('Space')
  await expect(value).toBeHidden()
  expect(await scene.state()).toEqual(before)
  await manager.screenshot({
    path: test.info().outputPath('collapsed-property.png'),
    animations: 'disabled'
  })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await scene.select(scene.ids.badge)
  await createProperty(page, 'Visibility', 'Show badge')
  await scene.select(scene.ids.component)
  await expect(toggle).toHaveAttribute('aria-expanded', 'false')
  const badgeToggle = manager.getByRole('button', {
    name: 'Component properties: Show badge',
    exact: true
  })
  await expect(badgeToggle).toHaveAttribute('aria-expanded', 'false')
  await expect(manager.getByRole('switch', { name: 'Default value', exact: true })).toBeHidden()
  await badgeToggle.click()
  await expect(manager.getByRole('switch', { name: 'Default value', exact: true })).toBeVisible()
  await manager.screenshot({
    path: test.info().outputPath('mixed-property-cards.png'),
    animations: 'disabled'
  })
})

test('shows component authoring controls after opening a saved document', async ({ page }) => {
  const scene = await createPropertyAuthoringScene(page)
  await scene.select(scene.ids.component)
  await expect(propertySection(page, 'Component properties')).toBeVisible()
  await saveAndReopenPropertyDocument(page, test.info().outputPath('component-properties.fig'))
  const ids = await page.evaluate(() => {
    const editor = window.openPencil?.getStore?.()
    if (!editor) throw new Error('Editor unavailable')
    const component = editor.graph
      .getChildren(editor.state.currentPageId)
      .find((node) => node.name === 'Button')
    if (!component) throw new Error('Reopened component unavailable')
    const label = editor.graph.getChildren(component.id).find((node) => node.name === 'Caption')
    if (!label) throw new Error('Reopened label unavailable')
    return { component: component.id, label: label.id }
  })
  await scene.select(ids.component)
  const manager = propertySection(page, 'Component properties')
  await expect(manager.getByRole('button', { name: 'Create property…', exact: true })).toBeVisible()
  await scene.select(ids.label)
  await createProperty(page, 'Text content', 'Reopened caption')
  await scene.select(ids.component)
  await expect(manager.getByRole('textbox', { name: 'Property name', exact: true })).toHaveValue(
    'Reopened caption'
  )
  scene.canvas.assertNoErrors()
})

test('shows component and object properties after restoring startup recovery', async ({ page }) => {
  const scene = await createPropertyAuthoringScene(page)
  await scene.select(scene.ids.label)
  await createProperty(page, 'Text content', 'Recovered caption')
  await page.evaluate(async () => {
    const editor = window.openPencil?.getStore?.()
    if (!editor) throw new Error('Editor unavailable')
    await editor.persistRecoveryNow()
  })
  page.once('dialog', (dialog) => dialog.accept())
  await page.reload()
  await expect(page.getByRole('alertdialog', { name: 'Recover unsaved work' })).toBeVisible()
  await page.getByRole('button', { name: 'Restore', exact: true }).click()
  await expect(page.getByRole('alertdialog', { name: 'Recover unsaved work' })).toBeHidden()
  await scene.canvas.waitForInit()
  const ids = await page.evaluate(() => {
    const editor = window.openPencil?.getStore?.()
    if (!editor) throw new Error('Editor unavailable')
    const component = editor.graph
      .getChildren(editor.state.currentPageId)
      .find((node) => node.name === 'Button')
    if (!component) throw new Error('Recovered component unavailable')
    const label = editor.graph.getChildren(component.id).find((node) => node.name === 'Caption')
    if (!label) throw new Error('Recovered label unavailable')
    return { component: component.id, label: label.id }
  })
  await scene.select(ids.component)
  const manager = propertySection(page, 'Component properties')
  await expect(manager.getByRole('textbox', { name: 'Property name', exact: true })).toHaveValue(
    'Recovered caption'
  )
  await expect(
    manager.getByRole('button', { name: 'Component properties: Recovered caption', exact: true })
  ).toHaveAttribute('aria-expanded', 'false')
  await scene.select(ids.label)
  await expect(
    propertySection(page, 'Expose as component property').getByRole('button', {
      name: 'Text content: Recovered caption',
      exact: true
    })
  ).toBeVisible()
  scene.canvas.assertNoErrors()
})

test('appearance respects linked visibility and places the mask beside it', async ({ page }) => {
  const scene = await createPropertyAuthoringScene(page)
  await scene.select(scene.ids.badge)
  await createProperty(page, 'Visibility', 'Show badge')
  const appearance = propertySection(page, 'Appearance')
  const visibility = appearance.getByRole('button', { name: 'Toggle visibility', exact: true })
  const link = appearance.getByRole('img', { name: 'Visibility: Show badge', exact: true })
  await expect(visibility).toBeDisabled()
  await expect(link).toBeVisible()
  await expect(appearance.getByRole('button', { name: 'Use as mask', exact: true })).toBeVisible()
  await appearance.screenshot({
    path: test.info().outputPath('linked-appearance.png'),
    animations: 'disabled'
  })
  await scene.select(scene.ids.instance)
  await propertySection(page, 'Component properties')
    .getByRole('switch', { name: 'Show badge', exact: true })
    .click()
  const instanceBadgeId = await page.evaluate((id) => {
    const editor = window.openPencil?.getStore?.()
    const badge = editor?.graph.getChildren(id).find((node) => node.name === 'Badge')
    if (!badge) throw new Error('Missing instance badge')
    return badge.id
  }, scene.ids.instance)
  await scene.select(instanceBadgeId)
  await expect(visibility).toBeDisabled()
  await expect(visibility).toHaveAttribute('aria-pressed', 'true')
  await expect(link).toBeVisible()
  await scene.select(scene.ids.badge)
  await expect(visibility).not.toHaveAttribute('aria-pressed', 'true')
  const exposure = propertySection(page, 'Expose as component property')
  await exposure.getByRole('button', { name: 'Visibility: Show badge', exact: true }).click()
  await page.getByRole('menuitem', { name: 'Unbind', exact: true }).click()
  await expect(visibility).toBeEnabled()
  await expect(link).toHaveCount(0)
  await visibility.click()
  await expect(visibility).toHaveAttribute('aria-pressed', 'true')
  await scene.canvas.undo()
  await expect(visibility).not.toHaveAttribute('aria-pressed', 'true')
  await scene.canvas.undo()
  await expect(visibility).toBeDisabled()
  await expect(link).toBeVisible()
  scene.canvas.assertNoErrors()
})

test('linked canvas text focuses defaults or instance overrides and edits only after unlinking', async ({
  page
}) => {
  const scene = await createPropertyLayoutScene(page)
  await createProperty(page, 'Text content', 'Button label')
  async function clickSelectedText(id: string) {
    await scene.select(id)
    const position = await page.evaluate((nodeId) => {
      const editor = window.openPencil?.getStore?.()
      const node = editor?.graph.getNode(nodeId)
      if (!editor || !node) throw new Error('Missing text')
      const absolute = editor.graph.getAbsolutePosition(nodeId)
      return { x: absolute.x + node.width / 2, y: absolute.y + node.height / 2 }
    }, id)
    await page.keyboard.down('Meta')
    await scene.canvas.click(position.x, position.y)
    await page.keyboard.up('Meta')
    await scene.canvas.dblclick(position.x, position.y)
  }
  const before = await scene.layout()
  await clickSelectedText(scene.ids.label)
  expect(await getEditingTextId(page)).toBeNull()
  const manager = propertySection(page, 'Component properties')
  const defaultValue = manager.getByRole('textbox', { name: 'Default value', exact: true })
  await expect(defaultValue).toBeFocused()
  await defaultValue.fill('Purchase a subscription')
  await defaultValue.blur()
  await expect.poll(async () => (await scene.layout()).width).toBeGreaterThan(before.width)
  const instanceTextId = await page.evaluate((id) => {
    const editor = window.openPencil?.getStore?.()
    const text = editor?.graph.getChildren(id).find((node) => node.name === 'Caption')
    if (!text) throw new Error('Missing instance text')
    return text.id
  }, scene.ids.instance)
  await clickSelectedText(instanceTextId)
  expect(await getEditingTextId(page)).toBeNull()
  const override = manager.getByRole('textbox', { name: 'Button label', exact: true })
  await expect(override).toBeFocused()
  await override.fill('Custom')
  await override.blur()
  await expect
    .poll(async () => (await scene.state()).children.find((node) => node.name === 'Caption')?.text)
    .toBe('Custom')
  expect((await scene.state()).definitions[0]?.defaultValue).toBe('Purchase a subscription')
  await scene.select(scene.ids.label)
  await page.getByTestId('canvas-element').focus()
  await scene.canvas.pressKey('Enter')
  await expect(defaultValue).toBeFocused()
  await scene.select(scene.ids.label)
  const exposure = propertySection(page, 'Expose as component property')
  await exposure.getByRole('button', { name: 'Text content: Button label', exact: true }).click()
  await page.getByRole('menuitem', { name: 'Unbind', exact: true }).click()
  await clickSelectedText(scene.ids.label)
  await expect.poll(() => getEditingTextId(page)).toBe(scene.ids.label)
  scene.canvas.assertNoErrors()
})
