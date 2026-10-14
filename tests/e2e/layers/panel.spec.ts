import { expect, test, useEditorSetup } from '#tests/e2e/fixtures'

const editor = useEditorSetup('/?test')

test.beforeAll(async () => {
  await editor.page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('Editor unavailable')
    const frame = store.graph.createNode('FRAME', store.state.currentPageId, {
      name: 'Example frame',
      x: 100,
      y: 100,
      width: 320,
      height: 240
    })
    store.graph.createNode('FRAME', frame.id, {
      name: 'Nested frame',
      x: 40,
      y: 40,
      width: 140,
      height: 80
    })
    const library = store.graph.createNode('FRAME', store.state.currentPageId, {
      name: 'Components',
      x: 460,
      y: 100,
      width: 160,
      height: 160
    })
    store.graph.createNode('COMPONENT', library.id, {
      name: 'Example component',
      x: 20,
      y: 20,
      width: 80,
      height: 40
    })
    store.requestRender()
  })
  await editor.canvas.waitForRender()
})

function layerRows() {
  return editor.page.locator('[data-node-id]')
}

async function getLayerNames(): Promise<string[]> {
  const rows = layerRows()
  const count = await rows.count()
  const names: string[] = []
  for (let i = 0; i < count; i++) {
    const text = await rows.nth(i).innerText()
    names.push(text.trim())
  }
  return names
}

interface SceneTreeNode {
  name: string
  type: string
  children: SceneTreeNode[]
}

async function getSceneTree(): Promise<SceneTreeNode> {
  return editor.page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) return null

    function nodeTree(id: string): SceneTreeNode | null {
      const node = store.graph.getNode(id)
      if (!node) return null
      return {
        name: node.name,
        type: node.type,
        children: node.childIds.map((cid: string) => nodeTree(cid)).filter(Boolean)
      }
    }
    const tree = nodeTree(store.state.currentPageId)
    if (!tree) throw new Error('Missing current page tree')
    return tree
  })
}

async function getSelectedCount(): Promise<number> {
  return editor.page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    return store.state.selectedIds.size
  })
}

const NUMBERED_GROUP = /^Group \d+$/

test('document layers visible in panel', async () => {
  const names = await getLayerNames()
  expect(names).toContain('Example frame')
  expect(names).toContain('Components')
})

test('clicking a node inside a frame does not reparent it', async () => {
  const target = await editor.page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    const nodes = [...store.graph.nodes.values()]
    const root = nodes.find((node) => node.name === 'Example frame')
    const nested = nodes.find((node) => node.name === 'Nested frame')
    if (!root || !nested?.parentId) throw new Error('Fixture hierarchy not found')
    const origin = store.graph.getAbsolutePosition(nested.id)
    return {
      id: nested.id,
      parentId: nested.parentId,
      rootId: root.id,
      x: (origin.x + nested.width / 2) * store.state.zoom + store.state.panX,
      y: (origin.y + nested.height / 2) * store.state.zoom + store.state.panY
    }
  })

  // Click inside the nested frame hierarchy.
  await editor.canvas.click(target.x, target.y)
  await editor.canvas.waitForRender()

  const after = await editor.page.evaluate(
    ({ id, rootId }) => {
      const store = window.openPencil?.getStore?.()
      if (!store) throw new Error('OpenPencil store not initialized')
      return {
        parentId: store.graph.getNode(id)?.parentId ?? null,
        rootParentId: store.graph.getNode(rootId)?.parentId ?? null,
        pageId: store.state.currentPageId
      }
    },
    { id: target.id, rootId: target.rootId }
  )

  // The clicked node and its section must keep their place in the hierarchy.
  expect(after.parentId).toBe(target.parentId)
  expect(after.rootParentId).toBe(after.pageId)

  editor.canvas.assertNoErrors()
})

test('creating a shape updates layers', async () => {
  const before = await getLayerNames()
  await editor.canvas.drawRect(600, 500, 50, 50)
  const names = await getLayerNames()
  expect(names).toContain('Rectangle 1')
  expect(names.length).toBe(before.length + 1)

  await editor.canvas.undo()
  const after = await getLayerNames()
  expect(after.length).toBe(before.length)
  expect(after).not.toContain('Rectangle 1')
})

test('Shift+A wraps selection in auto-layout frame', async () => {
  // Draw two loose rectangles for this test
  await editor.canvas.drawRect(700, 600, 60, 60)
  await editor.canvas.drawRect(800, 600, 60, 60)
  await editor.canvas.selectAll()
  const count = await getSelectedCount()
  expect(count).toBeGreaterThanOrEqual(2)

  const before = await getLayerNames()

  await editor.page.keyboard.press('Shift+A')
  await editor.canvas.waitForRender()

  const tree = await getSceneTree()
  const autoFrame = tree.children.find((c) => c.name === 'Frame' && c.type === 'FRAME')
  expect(autoFrame).toBeTruthy()

  const after = await getLayerNames()
  expect(after).not.toEqual(before)
  expect(after).toContain('Frame')

  editor.canvas.assertNoErrors()
})

test('grouping updates layers', async () => {
  // Undo the auto-layout to restore flat structure
  await editor.canvas.undo()
  await editor.canvas.undo()
  await editor.canvas.waitForRender()

  // Draw two rects and group them
  await editor.canvas.drawRect(700, 600, 60, 60)
  await editor.canvas.drawRect(800, 600, 60, 60)
  await editor.canvas.selectAll()

  await editor.page.keyboard.press('Meta+g')
  await editor.canvas.waitForRender()

  // The canvas numbers a group past the highest "Group" number on the page, as Figma does.
  const tree = await getSceneTree()
  const group = tree.children.find((c) => NUMBERED_GROUP.test(c.name) && c.type === 'GROUP')
  expect(group).toBeTruthy()

  const names = await getLayerNames()
  expect(names.some((name) => NUMBERED_GROUP.test(name))).toBe(true)

  editor.canvas.assertNoErrors()
})

test('ungrouping updates layers', async () => {
  await editor.page.keyboard.press('Shift+Meta+g')
  await editor.canvas.waitForRender()

  const names = await getLayerNames()
  expect(names.some((name) => NUMBERED_GROUP.test(name))).toBe(false)
  expect(names.some((name) => /^Rectangle \d+$/.test(name))).toBe(true)

  editor.canvas.assertNoErrors()
})

test('double-click layer to rename', async () => {
  await editor.canvas.drawRect(900, 600, 50, 50)
  await editor.canvas.waitForRender()

  const row = layerRows().filter({ hasText: 'Rectangle' }).first()
  await row.dblclick()

  const input = editor.page.getByTestId('layers-item-input')
  await expect(input).toBeVisible()
  await input.fill('Renamed Layer')
  await input.press('Enter')

  await editor.canvas.waitForRender()
  const names = await getLayerNames()
  expect(names).toContain('Renamed Layer')

  editor.canvas.assertNoErrors()
})

test('clicking outside rename input commits', async () => {
  const row = layerRows().filter({ hasText: 'Renamed Layer' }).first()
  await row.dblclick()

  const input = editor.page.getByTestId('layers-item-input')
  await expect(input).toBeVisible()
  await input.fill('After Outside Click')

  await editor.page.mouse.click(500, 400)
  await editor.canvas.waitForRender()

  await expect(input).not.toBeVisible()
  const names = await getLayerNames()
  expect(names).toContain('After Outside Click')

  editor.canvas.assertNoErrors()
})

test('clearing a layer name keeps the name it had', async () => {
  await editor.canvas.drawRect(980, 600, 50, 50)
  await editor.canvas.waitForRender()

  const drawn = await editor.page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    const id = store ? [...store.state.selectedIds][0] : undefined
    return id ? (store?.graph.getNode(id)?.name ?? '') : ''
  })
  const row = layerRows().filter({ hasText: drawn }).last()
  const countBefore = await layerRows().count()

  await row.dblclick()

  const input = editor.page.getByTestId('layers-item-input')
  await expect(input).toBeVisible()
  await input.clear()
  await input.press('Enter')

  await editor.canvas.waitForRender()

  const countAfter = await layerRows().count()
  expect(countAfter).toBe(countBefore)

  const names = await getLayerNames()
  expect(drawn).toMatch(/^Rectangle \d+$/)
  expect(names).toContain(drawn)

  editor.canvas.assertNoErrors()
})

test('double-click does not toggle tree expand', async () => {
  const rowCountBefore = await layerRows().count()

  const containerRow = layerRows().filter({ hasText: 'Components' }).first()
  await containerRow.dblclick()
  await editor.canvas.waitForRender()

  const input = editor.page.getByTestId('layers-item-input')
  await expect(input).toBeVisible()
  await input.press('Escape')

  const rowCountAfter = await layerRows().count()
  expect(rowCountAfter).toBe(rowCountBefore)

  editor.canvas.assertNoErrors()
})
