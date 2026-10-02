import { beforeAll, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { deflateSync } from 'fflate'

import { exportFigFile, initCodec, parseFigFile, SceneGraph } from '@open-pencil/core'
import { fontManager } from '@open-pencil/core/text'
import { parseFigBuffer, writeFigArchive } from '@open-pencil/fig'
import {
  createNodeChangesMessage,
  encodeMessage,
  getSchemaBytes
} from '@open-pencil/kiwi/fig/codec'

beforeAll(async () => {
  await initCodec()
  const bytes = readFileSync(resolve(import.meta.dir, '../../../../../assets/Inter-Regular.ttf'))
  fontManager.markLoaded(
    'Inter',
    'Regular',
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
  )
})

/** Reproduce the previous writer using the same records, without the new provenance entry. */
function withoutParagraphMarker(bytes: Uint8Array): Uint8Array {
  const parsed = parseFigBuffer(bytes.buffer as ArrayBuffer)
  for (const node of parsed.nodeChanges) {
    node.pluginData = node.pluginData?.filter(
      (entry) => !(entry.pluginID === 'open-pencil' && entry.key === 'textLayout')
    )
  }
  return writeFigArchive({
    schemaDeflated: deflateSync(getSchemaBytes()),
    kiwiData: encodeMessage({
      ...createNodeChangesMessage(0, 0, parsed.nodeChanges),
      blobs: parsed.blobs.map((bytes) => ({ bytes }))
    }),
    thumbnailPNG: parsed.thumbnailPNG ?? new Uint8Array(),
    metaJSON: parsed.metaJSON ?? '{}',
    images: []
  })
}

for (const legacy of [false, true]) {
  test(`native text keeps its layout after ${legacy ? 'legacy' : 'new'} save and repeated reopen`, async () => {
    const graph = new SceneGraph()
    const settings = {
      name: 'Wrapped label',
      text: 'A longer label\nwith a new line',
      x: 40,
      y: 70,
      width: 120,
      height: 160,
      fontSize: 24,
      fontFamily: 'Inter',
      fontWeight: 400,
      lineHeight: null,
      textAutoResize: 'HEIGHT' as const,
      textAlignHorizontal: 'CENTER' as const,
      textAlignVertical: 'BOTTOM' as const
    }
    graph.createNode('TEXT', graph.getPages()[0].id, settings)
    const exported = await exportFigFile(graph)
    const decoded = parseFigBuffer(exported.buffer as ArrayBuffer)
    expect(
      decoded.nodeChanges.find((node) => node.name === settings.name)?.derivedTextData?.glyphs
        ?.length
    ).toBeGreaterThan(1)

    let restored = await parseFigFile(
      (legacy ? withoutParagraphMarker(exported) : exported).buffer as ArrayBuffer
    )
    for (let pass = 0; pass < 2; pass++) {
      const text = [...restored.getAllNodes()].find((node) => node.name === settings.name)
      expect(text).toMatchObject({
        ...settings,
        derivedTextGlyphs: [],
        derivedLayout: { width: settings.width, height: settings.height }
      })
      // Force serialization instead of the unchanged-archive fast path.
      if (!text) throw new Error('Missing restored label')
      restored.updateNode(text.id, { opacity: pass === 0 ? 0.8 : 1 })
      restored = await parseFigFile((await exportFigFile(restored)).buffer as ArrayBuffer)
    }
  })
}
