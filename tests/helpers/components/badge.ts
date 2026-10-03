import type { Page } from '@playwright/test'

import type { SceneNode } from '@open-pencil/scene-graph'

import { CanvasHelper } from '#tests/helpers/canvas'

type BadgeChild = Pick<SceneNode, 'id' | 'parentId' | 'type' | 'text' | 'componentId'>

export async function createComponentBadgeScene(page: Page) {
  await page.goto('/?test&no-rulers')
  const canvas = new CanvasHelper(page)
  await canvas.waitForInit()
  const setup = await page.evaluate(async () => {
    const editor = window.openPencil?.getStore?.()
    if (!editor) throw new Error('Editor unavailable')
    editor.state.panX = 0
    editor.state.panY = 0
    editor.state.zoom = 1.5
    const component = editor.graph.createNode('COMPONENT', editor.state.currentPageId, {
      name: 'Button',
      x: 60,
      y: 100,
      layoutMode: 'HORIZONTAL',
      primaryAxisSizing: 'HUG',
      counterAxisSizing: 'HUG',
      paddingLeft: 24,
      paddingRight: 24,
      paddingTop: 16,
      paddingBottom: 16,
      cornerRadius: 12,
      fills: [{ type: 'SOLID', color: { r: 0.1, g: 0.3, b: 0.8, a: 1 }, opacity: 1, visible: true }]
    })
    const label = editor.graph.createNode('TEXT', component.id, {
      text: 'Button',
      fontSize: 20,
      fontFamily: 'Inter',
      textAutoResize: 'WIDTH_AND_HEIGHT',
      fills: [{ type: 'SOLID', color: { r: 1, g: 1, b: 1, a: 1 }, opacity: 1, visible: true }]
    })
    await editor.loadFontsForNodes([label.id])
    editor.updateNode(label.id, { text: 'Button' })
    editor.select([component.id])
    return { component: component.id }
  })
  return {
    canvas,
    async pasteAndAddBadge() {
      // Exercise Copy and Paste with isolated clipboard I/O, never the user's clipboard.
      const clipboard = await page.evaluateHandle(() => {
        const original = Object.getOwnPropertyDescriptor(navigator, 'clipboard')
        let copied: (html: string) => void = () => undefined
        const html = new Promise<string>((resolve) => {
          copied = resolve
        })
        Object.defineProperty(navigator, 'clipboard', {
          configurable: true,
          value: {
            async write(items: ClipboardItem[]) {
              const item = items.find((entry) => entry.types.includes('text/html'))
              if (!item) throw new Error('No copied design HTML')
              copied(await (await item.getType('text/html')).text())
            }
          }
        })
        return {
          read: () => html,
          restore() {
            if (original) Object.defineProperty(navigator, 'clipboard', original)
            else Reflect.deleteProperty(navigator, 'clipboard')
          }
        }
      })
      try {
        await page.getByTestId('canvas-element').focus()
        await page.keyboard.press('Meta+c')
        const html = await clipboard.evaluate((handle) => handle.read())
        await page.evaluate((value) => {
          const clipboardData = new DataTransfer()
          clipboardData.setData('text/html', value)
          window.dispatchEvent(
            new ClipboardEvent('paste', { clipboardData, bubbles: true, cancelable: true })
          )
        }, html)
      } finally {
        await clipboard.evaluate((handle) => handle.restore())
        await clipboard.dispose()
      }
      await page.waitForFunction((componentId) => {
        const editor = window.openPencil?.getStore?.()
        return editor?.graph
          .getChildren(editor.state.currentPageId)
          .some((node) => node.type === 'INSTANCE' && node.componentId === componentId)
      }, setup.component)
      return page.evaluate((componentId) => {
        const editor = window.openPencil?.getStore?.()
        if (!editor) throw new Error('Editor unavailable')
        const instance = editor.graph
          .getChildren(editor.state.currentPageId)
          .find((node) => node.type === 'INSTANCE' && node.componentId === componentId)
        if (!instance) throw new Error('Pasted instance unavailable')
        editor.updateNode(instance.id, { x: 300, y: 100 })
        const badge = editor.graph.createNode('FRAME', componentId, {
          name: 'Badge',
          width: 32,
          height: 32,
          cornerRadius: 16,
          fills: [
            { type: 'SOLID', color: { r: 1, g: 0.65, b: 0.2, a: 1 }, opacity: 1, visible: true }
          ]
        })
        editor.select([badge.id])
        editor.requestRender()
        return badge.id
      }, setup.component)
    },
    async addNumber(badgeId: string) {
      return page.evaluate(async (id) => {
        const editor = window.openPencil?.getStore?.()
        if (!editor) throw new Error('Editor unavailable')
        const text = editor.graph.createNode('TEXT', id, {
          name: 'Number',
          text: '1',
          fontFamily: 'Inter',
          fontSize: 16,
          textAutoResize: 'WIDTH_AND_HEIGHT'
        })
        await editor.loadFontsForNodes([text.id])
        editor.updateNode(text.id, { text: '1' })
        editor.select([text.id])
        editor.requestRender()
        return text.id
      }, badgeId)
    },
    async select(id: string) {
      await page.evaluate((nodeId) => {
        const editor = window.openPencil?.getStore?.()
        if (!editor) throw new Error('Editor unavailable')
        editor.select([nodeId])
        editor.requestRender()
      }, id)
    },
    async readBadgeContents(badgeId: string) {
      return page.evaluate(
        ({ componentId, badgeId }) => {
          const editor = window.openPencil?.getStore?.()
          if (!editor) throw new Error('Editor unavailable')
          const graph = editor.graph
          const instance = graph
            .getChildren(editor.state.currentPageId)
            .find((node) => node.type === 'INSTANCE' && node.componentId === componentId)
          const copy =
            instance && graph.getChildren(instance.id).find((node) => node.componentId === badgeId)
          const descendants = (id: string): BadgeChild[] =>
            graph.getChildren(id).flatMap((node) => [
              {
                id: node.id,
                parentId: node.parentId,
                type: node.type,
                text: node.text,
                componentId: node.componentId
              },
              ...descendants(node.id)
            ])
          return [graph.getNode(badgeId), copy].map((badge) => {
            if (!badge) throw new Error('Badge unavailable')
            return { id: badge.id, layoutMode: badge.layoutMode, children: descendants(badge.id) }
          })
        },
        { componentId: setup.component, badgeId }
      )
    },
    async read() {
      return page.evaluate((componentId) => {
        const editor = window.openPencil?.getStore?.()
        if (!editor) throw new Error('Editor unavailable')
        const component = editor.graph.getNode(componentId)
        const instance = editor.graph
          .getChildren(editor.state.currentPageId)
          .find((node) => node.type === 'INSTANCE' && node.componentId === componentId)
        return [component, instance].map((root) => {
          const badge =
            root && editor.graph.getChildren(root.id).find((node) => node.name === 'Badge')
          const text = badge && editor.graph.getChildren(badge.id)[0]
          return {
            badge: badge && {
              id: badge.id,
              x: badge.x,
              y: badge.y,
              width: badge.width,
              height: badge.height,
              layoutPositioning: badge.layoutPositioning,
              visible: badge.visible
            },
            text: text && {
              x: text.x,
              y: text.y,
              width: text.width,
              height: text.height,
              textAutoResize: text.textAutoResize,
              fontWeight: text.fontWeight,
              textAlignHorizontal: text.textAlignHorizontal
            }
          }
        })
      }, setup.component)
    }
  }
}
