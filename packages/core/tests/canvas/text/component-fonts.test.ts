import { beforeAll, expect, spyOn, test } from 'bun:test'

import { expectDefined } from '#core-tests/helpers/assert'
import type { CanvasKit, TypefaceFontProvider } from 'canvaskit-wasm'

import type { SceneNode } from '@open-pencil/scene-graph'

import { buildParagraph, nodeFontReadiness } from '#core/canvas/text'
import { getCanvasKit } from '#core/canvaskit'
import { createEditor } from '#core/editor/create'
import { fontManager } from '#core/text/fonts'
import { fontRemoteCoverageDemand, fontResolver } from '#core/text/resolver'

let ck: CanvasKit
let small: ArrayBuffer
let title: ArrayBuffer
let inter: ArrayBuffer
beforeAll(async () => {
  ck = await getCanvasKit()
  ;[small, title, inter] = await Promise.all([
    Bun.file('tests/fixtures/fonts/Fredoka-Regular-small.ttf').arrayBuffer(),
    Bun.file('tests/fixtures/fonts/Fredoka-Regular-title.ttf').arrayBuffer(),
    Bun.file('packages/core/assets/Inter-Regular.ttf').arrayBuffer()
  ])
})

function paint(provider: TypefaceFontProvider, node: SceneNode) {
  const paragraph = buildParagraph({ ck, fontProvider: provider, fontsLoaded: true }, node)
  const surface = expectDefined(ck.MakeSurface(640, 120))
  try {
    paragraph.layout(620)
    surface.getCanvas().clear(ck.WHITE)
    paragraph.draw(surface.getCanvas(), 8, 8)
    surface.flush()
    const image = surface.makeImageSnapshot()
    try {
      return image.encodeToBytes()
    } finally {
      image.delete()
    }
  } finally {
    paragraph.delete()
    surface.delete()
  }
}

test('a component font change loads the characters in overridden instance labels even when Inter can substitute them', async () => {
  const family = 'Component subset test'
  const message = "It's a Croak!"
  const demand = fontRemoteCoverageDemand(family, 'Regular', Array.from(message))
  const editor = createEditor()
  const provider = ck.TypefaceFontProvider.Make()
  fontManager.attachProvider(ck, provider)
  fontManager.markLoaded('Inter', 'Regular', inter)
  fontManager.markLoaded('Complete subset reference', 'Regular', title)
  fontManager.setDownloadedFontCache({
    read: async (_family, _style, characters) => (characters === 'croak' ? small : title),
    write: async () => undefined
  })
  const settled = new Set<string>()
  const renderer = {
    ck,
    fontProvider: provider,
    fontsLoaded: true,
    onFontResolutionSettled: (_snapshot: unknown, ids: readonly string[]) => {
      for (const id of ids) settled.add(id)
    }
  }
  let finish: (() => void) | undefined
  const pending = new Promise<void>((resolve) => {
    finish = resolve
  })
  const loading = spyOn(fontManager, 'loadRemoteFont').mockImplementation(
    async (nextFamily, style, characters) => {
      await pending
      return fontManager.loadCachedFont(nextFamily, style, characters)
    }
  )
  try {
    await fontManager.loadCachedFont(family, 'Regular', 'croak')
    const component = editor.graph.createNode('COMPONENT', editor.state.currentPageId)
    const text = editor.graph.createNode('TEXT', component.id, {
      text: 'croak',
      fontFamily: 'Inter',
      fontSize: 64,
      width: 620,
      height: 100
    })
    const property = expectDefined(editor.exposeComponentProperty(text.id, 'TEXT', 'Label'))
    const instances = Array.from({ length: 2 }, () =>
      expectDefined(editor.graph.createInstance(component.id, editor.state.currentPageId))
    )
    for (const instance of instances)
      editor.setInstanceComponentProperty(instance.id, property, message)
    const customInstance = expectDefined(
      editor.graph.createInstance(component.id, editor.state.currentPageId)
    )
    const customLabel = expectDefined(editor.graph.getChildren(customInstance.id)[0])
    editor.updateNodeWithUndo(customLabel.id, { fontFamily: 'Complete subset reference' })
    editor.updateNodeWithUndo(text.id, { fontFamily: family })
    await Promise.resolve()
    const labels = instances.map((instance) =>
      expectDefined(editor.graph.getChildren(instance.id)[0])
    )
    for (const label of labels) {
      expect(label.fontFamily).toBe(family)
      expect(label.text).toBe(message)
    }
    expect(customLabel.fontFamily).toBe('Complete subset reference')
    const substituted = paint(provider, expectDefined(labels[0]))
    for (const label of labels) expect(nodeFontReadiness(renderer, label)).toBe('pending')
    expect(loading).toHaveBeenCalledTimes(1)
    finish?.()
    await fontResolver.demand(demand)
    expect(settled).toEqual(new Set(labels.map((label) => label.id)))
    for (const label of labels) {
      expect(nodeFontReadiness(renderer, label)).toBe('ready')
      expect(paint(provider, label)).not.toEqual(substituted)
      expect(paint(provider, label)).toEqual(
        paint(provider, { ...label, id: 'fresh', fontFamily: 'Complete subset reference' })
      )
    }
    editor.undo.undo()
    await Promise.resolve()
    expect(labels.map((label) => label.fontFamily)).toEqual(['Inter', 'Inter'])
    editor.undo.redo()
    await Promise.resolve()
    expect(labels.map((label) => label.fontFamily)).toEqual([family, family])
  } finally {
    finish?.()
    await fontResolver.demand(demand)
    loading.mockRestore()
    fontResolver.reset(demand)
    fontManager.setDownloadedFontCache(null)
    editor.dispose()
    fontManager.detachProvider(provider)
    provider.delete()
  }
})

test('a failed subset expansion leaves fallback text drawable without retrying on every repaint', async () => {
  const family = 'Unavailable component subset'
  const message = "It's a Croak!"
  const demand = fontRemoteCoverageDemand(family, 'Regular', Array.from(message))
  const editor = createEditor()
  const provider = ck.TypefaceFontProvider.Make()
  fontManager.attachProvider(ck, provider)
  fontManager.markLoaded('Inter', 'Regular', inter)
  fontManager.setDownloadedFontCache({
    read: async () => small,
    write: async () => undefined
  })
  const loading = spyOn(fontManager, 'loadRemoteFont').mockResolvedValue(null)
  try {
    await fontManager.loadCachedFont(family, 'Regular', 'croak')
    const node = editor.graph.createNode('TEXT', editor.state.currentPageId, {
      text: message,
      fontFamily: family
    })
    const renderer = { ck, fontProvider: provider, fontsLoaded: true }
    expect(nodeFontReadiness(renderer, node)).toBe('pending')
    await fontResolver.demand(demand)
    expect(nodeFontReadiness(renderer, node)).toBe('ready')
    expect(nodeFontReadiness(renderer, node)).toBe('ready')
    expect(loading).toHaveBeenCalledTimes(1)
  } finally {
    loading.mockRestore()
    fontResolver.reset(demand)
    fontManager.setDownloadedFontCache(null)
    editor.dispose()
    fontManager.detachProvider(provider)
    provider.delete()
  }
})
