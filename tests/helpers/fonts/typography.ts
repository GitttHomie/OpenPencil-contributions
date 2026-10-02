import type { Page } from '@playwright/test'

import type { FontManager } from '@open-pencil/core/text'

export async function createTypographyFixture(
  page: Page,
  options: { google?: boolean; fontSize?: number } = {}
) {
  await page.evaluate(async ({ google }) => {
    const editor = window.openPencil?.getStore?.()
    if (!editor?.renderer) throw new Error('Editor unavailable')
    const moduleURL = performance
      .getEntriesByType('resource')
      .map((entry) => entry.name)
      .find((url) => url.includes('/packages/core/src/text/fonts.ts'))
    if (!moduleURL) throw new Error('Font runtime unavailable')
    const { fontManager } = (await import(/* @vite-ignore */ moduleURL)) as {
      fontManager: FontManager
    }
    await fontManager.loadFont('Inter', 'SemiBold')
    if (google) {
      fontManager.setOnlineFontProviders({ google: true })
    } else {
      fontManager.setOnlineFontProviders({})
    }
  }, options)
  return page.evaluate(({ fontSize }) => {
    const editor = window.openPencil?.getStore?.()
    if (!editor) throw new Error('Editor unavailable')
    const node = editor.graph.createNode('TEXT', editor.state.currentPageId, {
      name: 'Typography regression',
      text: 'Selected type\nSecond line',
      x: 80,
      y: 120,
      width: 380,
      height: 240,
      fontFamily: 'Inter',
      fontWeight: 600,
      fontSize: fontSize ?? 32,
      lineHeight: 64,
      textAlignVertical: 'CENTER',
      fills: [
        { type: 'SOLID', color: { r: 0.1, g: 0.15, b: 0.25, a: 1 }, visible: true, opacity: 1 }
      ]
    })
    editor.select([node.id])
    editor.requestRender()
    return node.id
  }, options)
}

export async function readTypography(page: Page, id: string) {
  return page.evaluate(async (nodeId) => {
    const editor = window.openPencil?.getStore?.()
    const node = editor?.graph.getNode(nodeId)
    const moduleURL = performance
      .getEntriesByType('resource')
      .map((entry) => entry.name)
      .find((url) => url.includes('/packages/core/src/text/fonts.ts'))
    if (!moduleURL) throw new Error('Font runtime unavailable')
    const { fontManager, weightToStyle } = (await import(/* @vite-ignore */ moduleURL)) as {
      fontManager: FontManager
      weightToStyle: (weight: number, italic: boolean) => string
    }
    return (
      node && {
        fontFamily: node.fontFamily,
        fontSize: node.fontSize,
        fontWeight: node.fontWeight,
        fontSource: fontManager.loadedFontSource(
          node.fontFamily,
          weightToStyle(node.fontWeight, node.italic)
        )
      }
    )
  }, id)
}

export async function selectTextForTypography(page: Page, id: string, fontSize?: number) {
  await page.evaluate(
    ({ id, fontSize }) => {
      const editor = window.openPencil?.getStore?.()
      if (!editor) throw new Error('Editor unavailable')
      if (editor.state.editingTextId !== id) editor.startTextEditing(id)
      editor.textEditor?.selectAll()
      if (fontSize !== undefined) editor.updateNodeWithUndo(id, { fontSize })
      editor.requestRender()
    },
    { id, fontSize }
  )
}

export async function typographySelectionMatchesPaint(page: Page, id: string) {
  return page.evaluate((nodeId) => {
    const editor = window.openPencil?.getStore?.()
    const node = editor?.graph.getNode(nodeId)
    if (!editor?.renderer || !editor.textEditor || !node) throw new Error('Editor unavailable')
    const paragraph = editor.renderer.buildParagraph(node, undefined, { halfLeading: true })
    try {
      const offset = Math.max(0, (node.height - paragraph.getHeight()) / 2)
      const metrics = paragraph.getLineMetrics()
      const selected = editor.textEditor.getSelectionRects()
      return {
        selected,
        lines: metrics.map((line) => ({
          x: line.left,
          top: line.baseline - line.ascent + offset,
          bottom: line.baseline + line.descent + offset
        }))
      }
    } finally {
      paragraph.delete()
    }
  }, id)
}
