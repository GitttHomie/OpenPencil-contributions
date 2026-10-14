import type { Page } from '@playwright/test'

import type * as Core from '@open-pencil/core'

import type * as Preferences from '@/app/settings/preferences/store'

export function seedVisibilityLayout(page: Page) {
  return page.evaluate(async () => {
    const editor = window.openPencil?.getStore?.()
    if (!editor) throw new Error('Editor unavailable')
    const graph = editor.graph
    const component = graph.createNode('COMPONENT', editor.state.currentPageId, {
      name: 'Button',
      width: 300,
      height: 60,
      layoutMode: 'HORIZONTAL',
      primaryAxisSizing: 'FIXED',
      counterAxisSizing: 'FIXED',
      itemSpacing: 10
    })
    const fixed = graph.createNode('FRAME', component.id, {
      name: 'Fixed',
      width: 80,
      height: 60
    })
    const fill = graph.createNode('FRAME', component.id, {
      name: 'Content',
      width: 210,
      height: 60,
      layoutMode: 'HORIZONTAL',
      primaryAxisSizing: 'FIXED',
      counterAxisSizing: 'FIXED',
      layoutGrow: 1
    })
    graph.createNode('FRAME', fill.id, {
      name: 'Inner',
      width: 210,
      height: 60,
      layoutGrow: 1
    })
    editor.exposeComponentProperty(fixed.id, 'VISIBLE', 'Show fixed')
    editor.runLayoutForNode(component.id)
    const instance = graph.createInstance(component.id, editor.state.currentPageId, {
      name: 'Button instance',
      y: 100
    })
    if (!instance) throw new Error('Instance unavailable')
    await Promise.resolve()
    editor.select([instance.id])
  })
}

export function readVisibilityLayout(page: Page, select = false) {
  return page.evaluate((select) => {
    const editor = window.openPencil?.getStore?.()
    if (!editor) throw new Error('Editor unavailable')
    const graph = editor.graph
    const instance = graph
      .getChildren(editor.state.currentPageId)
      .find((node) => node.name === 'Button instance')
    if (!instance) throw new Error('Instance unavailable')
    if (select) editor.select([instance.id])
    const children = graph.getChildren(instance.id)
    const fixed = children.find((node) => node.name === 'Fixed')
    const fill = children.find((node) => node.name === 'Content')
    const inner = fill ? graph.getChildren(fill.id)[0] : undefined
    if (!fixed || !fill || !inner) throw new Error('Children unavailable')
    return { visible: fixed.visible, x: fill.x, width: fill.width, innerWidth: inner.width }
  }, select)
}

export async function renderInstancesWithHiddenAction(page: Page) {
  return page.evaluate(async () => {
    const editor = window.openPencil?.getStore?.()
    if (!editor) throw new Error('Editor unavailable')
    const path = '/packages/core/src/index.ts'
    const core: typeof Core = await import(path)
    const preferencesPath = '/src/app/settings/preferences/store.ts'
    const preferences: typeof Preferences = await import(preferencesPath)
    preferences.updateDesignCheckPreferences({ showOnCanvas: false })
    const graph = editor.graph
    const main = graph.createNode('COMPONENT', editor.state.currentPageId, {
      name: 'Main component',
      x: 40,
      y: 60,
      width: 240,
      height: 100,
      layoutMode: 'VERTICAL',
      primaryAxisSizing: 'HUG',
      counterAxisSizing: 'FIXED',
      itemSpacing: 20,
      derivedLayout: { width: 240, height: 100 },
      componentPropertyDefinitions: [
        { id: 'action', name: 'Show action', type: 'BOOLEAN', defaultValue: 'true' }
      ]
    })
    graph.createNode('FRAME', main.id, {
      name: 'Content',
      width: 240,
      height: 40,
      fills: [{ type: 'SOLID', color: { r: 0.1, g: 0.5, b: 0.7, a: 1 }, opacity: 1, visible: true }]
    })
    graph.createNode('FRAME', main.id, {
      name: 'Action',
      width: 240,
      height: 40,
      y: 60,
      componentPropertyReferences: [{ field: 'VISIBLE', propertyId: 'action' }],
      fills: [{ type: 'SOLID', color: { r: 0.9, g: 0.4, b: 0.1, a: 1 }, opacity: 1, visible: true }]
    })
    const list = graph.createNode('FRAME', editor.state.currentPageId, {
      name: 'Instances with action hidden',
      x: 320,
      y: 60,
      width: 240,
      layoutMode: 'VERTICAL',
      primaryAxisSizing: 'HUG',
      counterAxisSizing: 'FIXED',
      itemSpacing: 12,
      fills: []
    })
    const tool = core.ALL_TOOLS.find((entry) => entry.name === 'render')
    if (!tool) throw new Error('Render tool unavailable')
    await tool.execute(new core.FigmaAPI(graph), {
      parent_id: list.id,
      jsx: `<>
        <Instance of="${main.id}" properties={{action:"false"}} />
        <Instance of="${main.id}" properties={{action:"false"}} />
      </>`
    })
    editor.zoomTo100()
    editor.pan(-editor.state.panX, -editor.state.panY)
    editor.clearSelection()
    editor.requestRender()
    return {
      mainHeight: main.height,
      listHeight: list.height,
      rows: graph.getChildren(list.id).map(({ height, y }) => ({ height, y }))
    }
  })
}

export function seedDefaultVisibilityLayout(page: Page) {
  return page.evaluate(async () => {
    const editor = window.openPencil?.getStore?.()
    if (!editor) throw new Error('Editor unavailable')
    const preferencesPath = '/src/app/settings/preferences/store.ts'
    const preferences: typeof Preferences = await import(preferencesPath)
    preferences.updateDesignCheckPreferences({ showOnCanvas: false })
    const graph = editor.graph
    const main = graph.createNode('COMPONENT', editor.state.currentPageId, {
      name: 'Button',
      x: 40,
      y: 60,
      width: 240,
      layoutMode: 'VERTICAL',
      primaryAxisSizing: 'HUG',
      counterAxisSizing: 'FIXED',
      itemSpacing: 20
    })
    graph.createNode('FRAME', main.id, {
      name: 'Title',
      width: 240,
      height: 40,
      fills: [{ type: 'SOLID', color: { r: 0.1, g: 0.5, b: 0.7, a: 1 }, opacity: 1, visible: true }]
    })
    const subtext = graph.createNode('FRAME', main.id, {
      name: 'Subtext',
      width: 240,
      height: 40,
      fills: [{ type: 'SOLID', color: { r: 0.9, g: 0.4, b: 0.1, a: 1 }, opacity: 1, visible: true }]
    })
    const property = editor.exposeComponentProperty(subtext.id, 'VISIBLE', 'Show subtext')
    if (!property) throw new Error('Property unavailable')
    const list = graph.createNode('FRAME', editor.state.currentPageId, {
      name: 'Instances',
      x: 320,
      y: 60,
      width: 240,
      layoutMode: 'VERTICAL',
      primaryAxisSizing: 'HUG',
      counterAxisSizing: 'FIXED',
      itemSpacing: 12,
      fills: []
    })
    for (const [name, value] of [
      ['Inherited', undefined],
      ['Shown', 'true'],
      ['Hidden', 'false']
    ] as const) {
      const instance = graph.createInstance(main.id, list.id, { name })
      if (!instance) throw new Error('Instance unavailable')
      if (value !== undefined) editor.setInstanceComponentProperty(instance.id, property, value)
    }
    await Promise.resolve()
    editor.runLayoutForNode(main.id)
    editor.runLayoutForNode(list.id)
    editor.select([main.id])
    editor.zoomTo100()
    editor.pan(-editor.state.panX, -editor.state.panY)
  })
}

export function readDefaultVisibilityLayout(page: Page, select = false) {
  return page.evaluate((select) => {
    const editor = window.openPencil?.getStore?.()
    if (!editor) throw new Error('Editor unavailable')
    const graph = editor.graph
    const roots = graph.getChildren(editor.state.currentPageId)
    const main = roots.find((node) => node.name === 'Button')
    const list = roots.find((node) => node.name === 'Instances')
    if (!main || !list) throw new Error('Components unavailable')
    if (select) {
      editor.select([main.id])
      editor.zoomTo100()
      editor.pan(-editor.state.panX, -editor.state.panY)
    }
    return {
      mainHeight: main.height,
      listHeight: list.height,
      rows: graph.getChildren(list.id).map((node) => ({
        height: node.height,
        y: node.y,
        visible: graph.getChildren(node.id).find((child) => child.name === 'Subtext')?.visible
      }))
    }
  }, select)
}
