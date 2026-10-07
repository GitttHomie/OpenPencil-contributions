import type { Page } from '@playwright/test'

export function installScreenSampler(
  page: Page,
  result: 'color' | 'cancel' | 'unsupported' | 'deferred'
) {
  return page.addInitScript((result) => {
    if (result === 'unsupported') {
      Reflect.deleteProperty(window, 'EyeDropper')
      return
    }
    Object.defineProperty(window, 'EyeDropper', {
      configurable: true,
      value: class {
        async open() {
          if (result === 'cancel') throw new DOMException('Cancelled', 'AbortError')
          if (result === 'deferred')
            await new Promise<void>((resolve) => {
              window.addEventListener('test:sample-color', () => resolve(), { once: true })
            })
          return { sRGBHex: '#12ab34' }
        }
      }
    })
  }, result)
}

export async function seedSamplePaint(page: Page, kind: 'fill' | 'stroke' | 'gradient') {
  return page.evaluate((kind) => {
    const editor = window.openPencil?.getStore?.()
    if (!editor) throw new Error('Missing editor')
    const color = { r: 0.8, g: 0.2, b: 0.1, a: 0.4 }
    const paint = { type: 'SOLID' as const, color, opacity: 0.4, visible: true }
    const node = editor.graph.createNode('FRAME', editor.state.currentPageId, {
      name: 'Sample target',
      x: 120,
      y: 120,
      width: 180,
      height: 120,
      fills:
        kind === 'gradient'
          ? [
              {
                ...paint,
                type: 'GRADIENT_LINEAR',
                gradientStops: [
                  { position: 0, color },
                  { position: 1, color: { r: 1, g: 1, b: 1, a: 1 } }
                ]
              }
            ]
          : [paint],
      strokes: kind === 'stroke' ? [{ ...paint, weight: 4, align: 'INSIDE' }] : []
    })
    editor.select([node.id])
    editor.requestRender()
    return node.id
  }, kind)
}

export function samplePaint(page: Page, id: string, kind: 'fill' | 'stroke' | 'gradient') {
  return page.evaluate(
    ({ id, kind }) => {
      const node = window.openPencil?.getStore?.().graph.getNode(id)
      const paint = kind === 'stroke' ? node?.strokes[0] : node?.fills[0]
      if (!paint) throw new Error('Missing paint')
      return {
        color: kind === 'gradient' ? paint.gradientStops?.[0].color : paint.color,
        opacity: paint.opacity
      }
    },
    { id, kind }
  )
}
