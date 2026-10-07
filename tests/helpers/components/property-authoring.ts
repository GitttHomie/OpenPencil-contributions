import type { Page } from '@playwright/test'

import { CanvasHelper } from '#tests/helpers/canvas'

export async function saveAndReopenPropertyDocument(page: Page, path: string) {
  const picker = await page.evaluateHandle(() => {
    const save = window.showSaveFilePicker
    const open = window.showOpenFilePicker
    const graph = window.openPencil?.getStore?.().graph
    window.showSaveFilePicker = undefined
    window.showOpenFilePicker = undefined
    return {
      reopened() {
        const editor = window.openPencil?.getStore?.()
        return (
          editor &&
          editor.graph !== graph &&
          editor.graph
            .getChildren(editor.state.currentPageId)
            .some((node) => node.name === 'Button')
        )
      },
      restore() {
        window.showSaveFilePicker = save
        window.showOpenFilePicker = open
      }
    }
  })
  try {
    page.once('dialog', (dialog) => dialog.accept('component-properties.fig'))
    const download = page.waitForEvent('download')
    await page.keyboard.press('Meta+Shift+s')
    await (await download).saveAs(path)
    const chooser = page.waitForEvent('filechooser')
    await page.keyboard.press('Meta+o')
    await (await chooser).setFiles(path)
    await page.waitForFunction((handle) => handle.reopened(), picker)
  } finally {
    await picker.evaluate((handle) => handle.restore())
    await picker.dispose()
  }
}

export async function createPropertyAuthoringScene(page: Page) {
  await page.goto('/?test')
  const canvas = new CanvasHelper(page)
  await canvas.waitForInit()
  const ids = await page.evaluate(() => {
    const editor = window.openPencil?.getStore?.()
    if (!editor) throw new Error('Editor unavailable')
    const pageId = editor.state.currentPageId
    const component = editor.graph.createNode('COMPONENT', pageId, {
      name: 'Button',
      x: 60,
      y: 80,
      width: 160,
      height: 64
    })
    const label = editor.graph.createNode('TEXT', component.id, {
      name: 'Caption',
      text: 'Button',
      x: 16,
      y: 16
    })
    const second = editor.graph.createNode('TEXT', component.id, {
      name: 'Second label',
      text: 'Secondary',
      x: 16,
      y: 36
    })
    const badge = editor.graph.createNode('FRAME', component.id, {
      name: 'Badge',
      x: 140,
      y: -8,
      width: 24,
      height: 24
    })
    const iconA = editor.graph.createNode('COMPONENT', pageId, { name: 'Icon A' })
    const iconB = editor.graph.createNode('COMPONENT', pageId, { name: 'Icon B' })
    const icon = editor.graph.createInstance(iconA.id, component.id, {
      name: 'Icon',
      width: 16,
      height: 16
    })
    const instance = editor.graph.createInstance(component.id, pageId, {
      name: 'Button instance',
      x: 280,
      y: 80
    })
    if (!icon || !instance) throw new Error('Expected instances')
    editor.select([instance.id])
    return {
      component: component.id,
      label: label.id,
      second: second.id,
      badge: badge.id,
      icon: icon.id,
      iconB: iconB.id,
      instance: instance.id
    }
  })
  return {
    ids,
    canvas,
    async select(id: string) {
      await page.evaluate((nodeId) => {
        const editor = window.openPencil?.getStore?.()
        if (!editor) throw new Error('Editor unavailable')
        editor.select([nodeId])
      }, id)
    },
    async state() {
      return page.evaluate(({ component, instance }) => {
        const editor = window.openPencil?.getStore?.()
        if (!editor) throw new Error('Editor unavailable')
        return {
          definitions: editor.graph.getNode(component)?.componentPropertyDefinitions ?? [],
          assignments: editor.graph.getNode(instance)?.componentPropertyAssignments ?? {},
          children: editor.graph.getChildren(instance).map((node) => ({
            name: node.name,
            text: node.text,
            visible: node.visible,
            componentId: node.componentId
          }))
        }
      }, ids)
    }
  }
}

export async function createPropertyLayoutScene(page: Page) {
  const scene = await createPropertyAuthoringScene(page)
  const layoutIds = await page.evaluate(async (ids) => {
    const editor = window.openPencil?.getStore?.()
    if (!editor) throw new Error('Editor unavailable')
    editor.state.panX = 0
    editor.state.panY = 0
    editor.state.zoom = 1
    for (const id of [ids.second, ids.badge, ids.icon]) editor.graph.deleteNode(id)
    editor.updateNode(ids.component, {
      layoutMode: 'HORIZONTAL',
      primaryAxisSizing: 'HUG',
      counterAxisSizing: 'HUG',
      paddingLeft: 16,
      paddingRight: 16,
      paddingTop: 12,
      paddingBottom: 12,
      cornerRadius: 8,
      fills: [{ type: 'SOLID', color: { r: 0.2, g: 0.3, b: 0.8, a: 1 }, opacity: 1, visible: true }]
    })
    editor.updateNode(ids.label, {
      fontFamily: 'Inter',
      fontSize: 16,
      textAutoResize: 'WIDTH_AND_HEIGHT',
      fills: [{ type: 'SOLID', color: { r: 1, g: 1, b: 1, a: 1 }, opacity: 1, visible: true }]
    })
    await editor.loadFontsForNodes([ids.label])
    editor.updateNode(ids.label, { text: 'Button' })
    const row = editor.graph.createNode('FRAME', editor.state.currentPageId, {
      x: 280,
      y: 80,
      layoutMode: 'HORIZONTAL',
      primaryAxisSizing: 'HUG',
      counterAxisSizing: 'HUG',
      itemSpacing: 12
    })
    editor.graph.reparentNode(ids.instance, row.id)
    const sibling = editor.graph.createNode('FRAME', row.id, {
      width: 40,
      height: 40,
      cornerRadius: 8,
      fills: [{ type: 'SOLID', color: { r: 0.1, g: 0.6, b: 0.4, a: 1 }, opacity: 1, visible: true }]
    })
    editor.runLayoutForNode(row.id)
    editor.select([ids.label])
    return { row: row.id, sibling: sibling.id }
  }, scene.ids)
  return {
    ...scene,
    async layout() {
      return page.evaluate(
        (ids) => {
          const editor = window.openPencil?.getStore?.()
          if (!editor) throw new Error('Editor unavailable')
          const source = editor.graph.getNode(ids.component)
          const instance = editor.graph.getNode(ids.instance)
          const row = editor.graph.getNode(ids.row)
          const sibling = editor.graph.getNode(ids.sibling)
          if (!source || !instance || !row || !sibling) throw new Error('Layout nodes unavailable')
          return {
            sourceWidth: source.width,
            width: instance.width,
            height: instance.height,
            rowWidth: row.width,
            siblingX: sibling.x,
            siblingWidth: sibling.width,
            sizing: instance.primaryAxisSizing
          }
        },
        { ...scene.ids, ...layoutIds }
      )
    }
  }
}
