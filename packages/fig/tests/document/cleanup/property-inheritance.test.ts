import { beforeAll, expect, test } from 'bun:test'

import { guid } from '#fig-tests/helpers/guid'
import { parseFigBuffer, writeFigArchive } from '#fig/archive'
import { prepareFigComponentCleanup } from '#fig/document/cleanup'
import { createDocumentReader } from '#fig/document/read'
import { deflateSync } from 'fflate'

import { createFigDocumentSession } from '@open-pencil/fig'
import {
  getCompiledSchema,
  getSchemaBytes,
  initCodec,
  type NodeChange
} from '@open-pencil/kiwi/fig/codec'

beforeAll(() => initCodec())

function node(id: number, parent: number, fields: Partial<NodeChange>): NodeChange {
  return { guid: guid(id), parentIndex: { guid: guid(parent), position: String(id) }, ...fields }
}

function fixture(): NodeChange[] {
  return [
    { guid: guid(0), type: 'DOCUMENT' },
    node(1, 0, { type: 'CANVAS', name: 'Buttons & Links' }),
    node(2, 0, { type: 'CANVAS', internalOnly: true }),
    node(3, 1, { type: 'SYMBOL', name: 'Kept icon' }),
    node(4, 2, { type: 'SYMBOL', name: 'Deleted icon' }),
    node(10, 1, {
      type: 'FRAME',
      name: 'Button',
      isStateGroup: true,
      componentPropDefs: [
        { id: guid(90), type: 'INSTANCE_SWAP', name: 'Icon', initialValue: { guidValue: guid(4) } },
        {
          id: guid(91),
          type: 'TEXT',
          name: 'Label',
          initialValue: { textValue: { characters: 'Button' } }
        }
      ]
    }),
    node(11, 10, {
      type: 'SYMBOL',
      name: 'Default',
      componentPropDefs: [
        { id: guid(100), parentPropDefId: guid(90) },
        { id: guid(101), parentPropDefId: guid(91) }
      ]
    }),
    node(12, 11, {
      type: 'FRAME',
      componentPropDefs: [{ id: guid(110), parentPropDefId: guid(100) }]
    }),
    node(13, 12, {
      type: 'INSTANCE',
      symbolData: { symbolID: guid(3) },
      componentPropRefs: [{ defID: guid(110), componentPropNodeField: 'OVERRIDDEN_SYMBOL_ID' }]
    }),
    node(14, 11, {
      type: 'TEXT',
      name: 'Label',
      textData: { characters: 'Button' },
      componentPropRefs: [{ defID: guid(101), componentPropNodeField: 'TEXT_DATA' }]
    }),
    node(15, 1, {
      type: 'INSTANCE',
      symbolData: { symbolID: guid(11) },
      componentPropAssignments: [
        { defID: guid(100), value: { guidValue: guid(3) } },
        { defID: guid(101), value: { textValue: { characters: 'Save' } } }
      ]
    }),
    node(16, 10, {
      type: 'SYMBOL',
      name: 'Hover',
      componentPropDefs: [{ id: guid(120), parentPropDefId: guid(90) }]
    }),
    node(17, 16, {
      type: 'INSTANCE',
      symbolData: { symbolID: guid(3) },
      componentPropRefs: [{ defID: guid(120), componentPropNodeField: 'OVERRIDDEN_SYMBOL_ID' }]
    })
  ]
}

function archive(records: NodeChange[]) {
  return writeFigArchive({
    schemaDeflated: deflateSync(getSchemaBytes()),
    kiwiData: getCompiledSchema().encodeMessage({ nodeChanges: records, blobs: [] }),
    thumbnailPNG: new Uint8Array(),
    metaJSON: '{}'
  })
}

test('removes inherited definitions and their bindings transitively while keeping valid properties', () => {
  const bytes = archive(fixture())
  const cleanup = prepareFigComponentCleanup(bytes.buffer)
  const cleaned = cleanup.apply('internal')
  const records = parseFigBuffer(cleaned.buffer).nodeChanges
  const record = (id: number) => records.find((item) => item.guid?.localID === id)
  expect(record(11)?.componentPropDefs).toEqual([{ id: guid(101), parentPropDefId: guid(91) }])
  expect(record(12)?.componentPropDefs).toEqual([])
  expect(record(16)?.componentPropDefs).toEqual([])
  expect(record(13)).toBeUndefined()
  expect(record(17)).toBeUndefined()
  expect(record(3)).toBeDefined()
  expect(record(14)?.componentPropRefs).toEqual([
    { defID: guid(101), componentPropNodeField: 'TEXT_DATA' }
  ])
  expect(record(15)?.componentPropAssignments).toEqual([
    { defID: guid(101), value: { textValue: { characters: 'Save' } } }
  ])
  expect(() => createDocumentReader(records).readPage('1:1')).not.toThrow()
  const session = createFigDocumentSession(cleaned.buffer)
  expect(() => session.loadPage('1:1')).not.toThrow()
  expect(prepareFigComponentCleanup(cleaned.buffer).options.internal.nodeCount).toBe(0)
  expect(
    parseFigBuffer(bytes.buffer).nodeChanges.find((item) => item.guid?.localID === 11)
      ?.componentPropDefs
  ).toHaveLength(2)
})

test('repairs inherited links left by an older cleanup even after the internal canvas is gone', () => {
  const damaged = fixture()
    .filter((record) => ![2, 4, 13, 17].includes(record.guid?.localID ?? -1))
    .map((record) =>
      record.guid?.localID === 10
        ? { ...record, componentPropDefs: record.componentPropDefs?.slice(1) }
        : record
    )
  const bytes = archive(damaged)
  expect(() => createDocumentReader(damaged)).toThrow('Missing parent property')
  const cleanup = prepareFigComponentCleanup(bytes.buffer)
  expect(cleanup.options.internal.nodeCount).toBeGreaterThan(0)
  const cleaned = cleanup.apply('internal')
  const session = createFigDocumentSession(cleaned.buffer)
  expect(() => session.loadPage('1:1')).not.toThrow()
  expect([...session.graph.getAllNodes()].filter((node) => node.type === 'COMPONENT')).toHaveLength(
    3
  )
  expect(prepareFigComponentCleanup(cleaned.buffer).options.internal.nodeCount).toBe(0)
})
