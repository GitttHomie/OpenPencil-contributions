import { beforeAll, expect, test } from 'bun:test'

import type { CanvasKit, TypefaceFontProvider } from 'canvaskit-wasm'

import { getCanvasKit } from '#core/canvaskit'
import { FontManager } from '#core/text/fonts'

let ck: CanvasKit
let small: ArrayBuffer
let title: ArrayBuffer
let inter: ArrayBuffer
beforeAll(async () => {
  ck = await getCanvasKit()
  ;[small, title] = await Promise.all(
    ['small', 'title'].map((name) =>
      Bun.file(`tests/fixtures/fonts/Fredoka-Regular-${name}.ttf`).arrayBuffer()
    )
  )
  inter = await Bun.file('public/Inter-Regular.ttf').arrayBuffer()
})

function render(provider: TypefaceFontProvider, families: string[]) {
  const builder = ck.ParagraphBuilder.MakeFromFontProvider(
    new ck.ParagraphStyle({
      textStyle: { fontFamilies: families, fontSize: 64, color: ck.BLACK }
    }),
    provider
  )
  builder.addText("It's a Croak!")
  const paragraph = builder.build()
  const surface = ck.MakeSurface(640,120)
  if (!surface) throw new Error('Raster surface unavailable')
  try {
    paragraph.layout(620)
    surface.getCanvas().clear(ck.WHITE)
    surface.getCanvas().drawParagraph(paragraph, 8, 8)
    surface.flush()
    const image = surface.makeImageSnapshot()
    try {
      return {
        glyphs: paragraph.getShapedLines().flatMap((line) =>
          line.runs.flatMap((run) => [...run.glyphs])
        ),
        pixels: image.encodeToBytes()
      }
    } finally {
      image.delete()
    }
  } finally {
    surface.delete()
    paragraph.delete()
    builder.delete()
  }
}

test('an expanded Google subset paints the same title as a fresh complete face', () => {
  const manager = new FontManager()
  const provider = ck.TypefaceFontProvider.Make()
  const fresh = ck.TypefaceFontProvider.Make()
  const reattached = ck.TypefaceFontProvider.Make()
  manager.attachProvider(ck, provider)
  try {
    fresh.registerFont(title, 'Fredoka')
    provider.registerFont(inter, 'Inter')
    const expected = render(fresh, ['Fredoka'])
    expect(expected.glyphs.every((glyph) => glyph !== 0)).toBe(true)
    manager.markLoaded('Fredoka', 'Regular', small, 'google')
    expect(render(provider, manager.renderFamilies('Fredoka', 'Regular')).glyphs).toContain(0)
    const substituted = render(provider, [...manager.renderFamilies('Fredoka', 'Regular'), 'Inter'])
    expect(substituted.glyphs).not.toContain(0)
    expect(substituted.pixels).not.toEqual(expected.pixels)

    manager.markLoaded('Fredoka', 'Regular', title, 'google')
    const families = manager.renderFamilies('Fredoka', 'Regular')
    expect(render(provider, families)).toEqual(expected)
    expect(render(provider, [...families, 'Inter']).pixels).toEqual(expected.pixels)
    // Other scripts or subsets remain explicit fallbacks, rather than being hidden behind
    // TypefaceFontProvider's first same-style face.
    expect(render(provider, families.toReversed()).glyphs).not.toContain(0)

    manager.attachProvider(ck, reattached)
    expect(render(reattached, manager.renderFamilies('Fredoka', 'Regular'))).toEqual(expected)
    manager.markLoaded('Fredoka', 'Regular', title, 'cache')
    expect(manager.renderFamilies('Fredoka', 'Regular')).toEqual(families)
    expect(render(provider, families)).toEqual(expected)
  } finally {
    manager.detachProvider(provider)
    manager.detachProvider(reattached)
    provider.delete()
    fresh.delete()
    reattached.delete()
  }
})
