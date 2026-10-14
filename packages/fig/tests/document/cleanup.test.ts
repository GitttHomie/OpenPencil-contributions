import { beforeAll, expect, test } from 'bun:test'

import { guid } from '#fig-tests/helpers/guid'
import { parseFigBuffer, writeFigArchive } from '#fig/archive'
import { planFigComponentCleanup, prepareFigComponentCleanup } from '#fig/document/cleanup'
import { planFigInternalCleanup } from '#fig/document/cleanup/internal'
import { interpretInstance } from '#fig/instance-overrides/interpret'
import { symbolOverridesOf } from '#fig/instance-overrides/types'
import { deflateSync } from 'fflate'

import {
  getCompiledSchema,
  getSchemaBytes,
  initCodec,
  type NodeChange
} from '@open-pencil/kiwi/fig/codec'

const node = (id: number, parent: number, extra: Partial<NodeChange> = {}): NodeChange => ({
  guid: guid(id),
  parentIndex: { guid: guid(parent), position: String(id) },
  type: 'FRAME',
  ...extra
})
const pages = (): NodeChange[] => [
  { guid: guid(0), type: 'DOCUMENT' },
  node(1, 0, { type: 'CANVAS' }),
  node(2, 0, { type: 'CANVAS', internalOnly: true })
]
const removed = (records: NodeChange[]) =>
  planFigComponentCleanup(records)
    .removed.map((id) => id.localID)
    .sort((a, b) => a - b)

test('only deletes internal definitions, preserving unused library and presentation components on normal pages', () => {
  const records = [
    ...pages(),
    node(3, 1, { type: 'SYMBOL', name: 'Presentation' }),
    node(4, 1, { isStateGroup: true }),
    node(5, 4, { type: 'SYMBOL', name: 'Library variant' }),
    node(6, 2, { type: 'SYMBOL', name: 'Deleted component' }),
    node(7, 6, { type: 'TEXT' }),
    node(8, 2, { type: 'TEXT', name: 'Unrelated internal resource' })
  ]
  expect(removed(records)).toEqual([6])
  expect(planFigComponentCleanup(records).nodeCount).toBe(2)
})

test('follows nested dependencies from unused components on normal pages too', () => {
  expect(
    removed([
      ...pages(),
      node(3, 1, { type: 'SYMBOL' }),
      node(4, 3, { type: 'INSTANCE', symbolData: { symbolID: guid(5) } }),
      node(5, 2, { type: 'SYMBOL' }),
      node(6, 5, { type: 'INSTANCE', symbolData: { symbolID: guid(7) } }),
      node(7, 2, { type: 'SYMBOL' }),
      node(8, 2, { type: 'SYMBOL' })
    ])
  ).toEqual([8])
})

test('preserves inactive swap defaults, preferred choices and overrides', () => {
  const symbolData = {
    symbolID: guid(3),
    symbolOverrides: [{ overriddenSymbolID: guid(6) }]
  }
  expect(
    removed([
      ...pages(),
      node(3, 1, {
        type: 'SYMBOL',
        componentPropDefs: [
          {
            id: guid(90),
            type: 'INSTANCE_SWAP',
            initialValue: { guidValue: guid(4) },
            preferredValues: { instanceSwapValues: [{ key: 'preferred' }] }
          }
        ]
      }),
      node(4, 2, { type: 'SYMBOL' }),
      node(5, 2, { type: 'SYMBOL', key: 'preferred' }),
      node(6, 2, { type: 'SYMBOL' }),
      node(7, 2, { type: 'SYMBOL' }),
      node(8, 1, {
        type: 'INSTANCE',
        symbolData
      })
    ])
  ).toEqual([7])
})

test('keeps a component owning a referenced child and all variants in an internal set', () => {
  expect(
    removed([
      ...pages(),
      node(3, 1, { prototypeInteractions: [{ actions: [{ nodeID: guid(5) }] }] }),
      node(4, 2, { type: 'SYMBOL' }),
      node(5, 4),
      node(6, 2, { isStateGroup: true }),
      node(7, 6, { type: 'SYMBOL' }),
      node(8, 6, { type: 'SYMBOL' }),
      node(9, 1, { type: 'INSTANCE', symbolData: { symbolID: guid(7) } }),
      node(10, 2, { type: 'SYMBOL' })
    ])
  ).toEqual([10])
})

test('deletes unreachable internal cycles without affecting referenced components', () => {
  expect(
    removed([
      ...pages(),
      node(3, 2, { type: 'SYMBOL' }),
      node(4, 3, { type: 'INSTANCE', symbolData: { symbolID: guid(5) } }),
      node(5, 2, { type: 'SYMBOL' }),
      node(6, 5, { type: 'INSTANCE', symbolData: { symbolID: guid(3) } })
    ])
  ).toEqual([3, 5])
})

test('cleans an unused embedded set as a whole but preserves a visible set without instances', () => {
  const records = [
    ...pages(),
    node(3, 2, { isStateGroup: true }),
    node(4, 3, { type: 'SYMBOL' }),
    node(5, 3, { type: 'SYMBOL' }),
    node(6, 1, { isStateGroup: true }),
    node(7, 6, { type: 'SYMBOL' })
  ]
  expect(removed(records)).toEqual([3, 4, 5])
  expect(planFigComponentCleanup(records).componentCount).toBe(2)
})

test('empty internal canvases do not need cleanup', () => {
  expect(planFigComponentCleanup(pages())).toEqual({ componentCount: 0, nodeCount: 0, removed: [] })
})

test('full cleanup preserves variables and shared styles while removing internal components', () => {
  const records = [
    ...pages(),
    node(3, 2, { type: 'SYMBOL' }),
    node(4, 1, { type: 'INSTANCE', symbolData: { symbolID: guid(3) } }),
    node(5, 2, { type: 'VARIABLE_SET', name: 'Theme' }),
    node(6, 5, { type: 'VARIABLE', name: 'Spacing' }),
    node(7, 2, { type: 'RECTANGLE', styleType: 'FILL', name: 'Surface' }),
    node(8, 1, { styleIdForFill: { guid: guid(7) } })
  ]
  const bytes = writeFigArchive({
    schemaDeflated: deflateSync(getSchemaBytes()),
    kiwiData: getCompiledSchema().encodeMessage({ nodeChanges: records, blobs: [] }),
    thumbnailPNG: new Uint8Array(),
    metaJSON: '{}'
  })
  const prepared = prepareFigComponentCleanup(bytes.buffer)
  const cleaned = parseFigBuffer(prepared.apply('internal').buffer)
  expect(cleaned.nodeChanges.map((record) => record.guid?.localID)).toEqual([0, 1, 2, 5, 6, 7, 8])
  for (const id of [5, 6, 7, 8]) {
    expect(cleaned.nodeChanges.find((record) => record.guid?.localID === id)).toEqual(
      parseFigBuffer(bytes.buffer).nodeChanges.find((record) => record.guid?.localID === id)
    )
  }
  expect(planFigInternalCleanup(cleaned.nodeChanges).nodeCount).toBe(0)
  expect(prepared.options.internal.canvasCount).toBe(0)
})

test('preserves dependencies from other pages and assigned internal slot content', () => {
  expect(
    removed([
      ...pages(),
      node(3, 0, { type: 'CANVAS' }),
      node(4, 3, {
        type: 'INSTANCE',
        symbolData: { symbolID: guid(5) },
        componentPropAssignments: [
          {
            defID: guid(90),
            varValue: { value: { slotContentIdValue: { guid: guid(6) } } }
          }
        ]
      }),
      node(5, 2, { type: 'SYMBOL' }),
      node(6, 2, { isSlotContent: true }),
      node(7, 6, { type: 'INSTANCE', symbolData: { symbolID: guid(8) } }),
      node(8, 2, { type: 'SYMBOL' }),
      node(9, 2, { type: 'SYMBOL' })
    ])
  ).toEqual([9])
})

test('an unresolved required hierarchy prevents cleanup', () => {
  expect(
    removed([
      ...pages(),
      node(3, 1, { type: 'INSTANCE', symbolData: { symbolID: guid(4) } }),
      node(4, 99, { type: 'SYMBOL' }),
      node(5, 2, { type: 'SYMBOL' })
    ])
  ).toEqual([])
})

test('stale handoff annotations do not keep deleted components alive', () => {
  const records = pages()
  const page = records[1]
  if (!page) throw new Error('Missing fixture page')
  page.handoffStatusMap = { entries: [{ guid: guid(3), handoffStatus: { status: 'NONE' } }] }
  records.push(node(3, 2, { type: 'SYMBOL' }))
  expect(removed(records)).toEqual([3])
})

beforeAll(() => initCodec())

test('cleanup preserves remaining archive records, images and metadata, and is idempotent', () => {
  const records = [
    ...pages(),
    node(3, 1, { type: 'SYMBOL', name: 'Visible library', opacity: 0.75 }),
    node(4, 2, { type: 'SYMBOL', name: 'Unused internal' }),
    node(5, 4, { type: 'TEXT', name: 'Deleted child' })
  ]
  const image = new Uint8Array([1, 2, 3])
  const bytes = new Uint8Array(
    writeFigArchive({
      schemaDeflated: deflateSync(getSchemaBytes()),
      kiwiData: getCompiledSchema().encodeMessage({ nodeChanges: records, blobs: [] }),
      thumbnailPNG: new Uint8Array(),
      metaJSON: '{"name":"Test"}',
      images: [{ name: 'images/test', data: image }]
    })
  ).buffer
  const original = new Uint8Array(bytes).slice()
  const prepared = prepareFigComponentCleanup(bytes)
  expect(prepared.summary).toEqual({ componentCount: 1, nodeCount: 2 })
  const cleaned = new Uint8Array(prepared.apply()).buffer
  const parsed = parseFigBuffer(cleaned)
  const expected = parseFigBuffer(bytes).nodeChanges.filter(
    (record) => ![4, 5].includes(record.guid?.localID ?? -1)
  )
  expect(parsed.nodeChanges).toEqual(expected)
  expect(parsed.images).toEqual([['test', image]])
  expect(parsed.metaJSON).toBe('{"name":"Test"}')
  expect(new Uint8Array(bytes)).toEqual(original)
  expect(prepareFigComponentCleanup(cleaned).summary.componentCount).toBe(0)
})

test('full cleanup removes internal pages, removed variants and linked instances, but preserves valid containers', () => {
  const records = [
    ...pages(),
    node(3, 1, { type: 'SYMBOL', name: 'Valid button' }),
    node(4, 3, { type: 'TEXT', name: 'Button label' }),
    node(5, 3, { type: 'INSTANCE', symbolData: { symbolID: guid(10) } }),
    node(6, 1, { type: 'INSTANCE', symbolData: { symbolID: guid(3) } }),
    node(7, 1, { type: 'INSTANCE', symbolData: { symbolID: guid(11) }, visible: false }),
    node(8, 7, { type: 'TEXT' }),
    node(9, 1, { type: 'SYMBOL', name: 'Unused presentation component' }),
    node(10, 2, { type: 'SYMBOL', name: 'Deleted icon' }),
    node(11, 2, { type: 'SYMBOL', name: 'Deleted button variant' }),
    node(12, 2, { type: 'TEXT', name: 'Other internal content' }),
    node(13, 0, { type: 'CANVAS', name: 'Another page' }),
    node(14, 13, { type: 'INSTANCE', symbolData: { symbolID: guid(11) } }),
    node(15, 1, { type: 'INSTANCE', symbolData: { symbolID: guid(99) } })
  ]
  const plan = planFigInternalCleanup(records)
  expect(plan).toMatchObject({ canvasCount: 1, componentCount: 2, instanceCount: 4, pageCount: 2 })
  const ids = plan.removed.map((id) => id.localID)
  expect(ids).toEqual([2, 5, 7, 8, 10, 11, 12, 14, 15])
  expect(ids).not.toContain(3)
  expect(ids).not.toContain(4)
  expect(ids).not.toContain(6)
  expect(ids).not.toContain(9)
})

test('a removed nested swap hides only that occurrence and drops stale cached overrides', () => {
  const records = [
    ...pages(),
    node(3, 1, { type: 'SYMBOL', name: 'Valid button' }),
    node(4, 3, { type: 'INSTANCE', symbolData: { symbolID: guid(7) } }),
    node(5, 3, { type: 'TEXT', textData: { characters: 'Keep label' } }),
    node(6, 1, {
      type: 'INSTANCE',
      symbolData: {
        symbolID: guid(3),
        symbolOverrides: [{ guidPath: { guids: [guid(4)] }, overriddenSymbolID: guid(10) }]
      },
      derivedSymbolData: [{ guidPath: { guids: [guid(10)] }, size: { x: 99, y: 99 } }]
    }),
    node(7, 1, { type: 'SYMBOL', name: 'Valid default icon' }),
    node(8, 7),
    node(9, 1, { type: 'INSTANCE', symbolData: { symbolID: guid(3) } }),
    node(10, 2, { type: 'SYMBOL', name: 'Removed replacement' })
  ]
  const plan = planFigInternalCleanup(records)
  expect(plan).toMatchObject({ instanceCount: 0, hiddenInstanceCount: 1 })
  const replacement = plan.records.find((record) => record.guid?.localID === 6)
  expect(replacement).toBeDefined()
  expect(replacement?.derivedSymbolData).toEqual([])
  if (!replacement) throw new Error('Missing rewritten instance')
  expect(symbolOverridesOf(replacement)).toEqual([
    { guidPath: { guids: [guid(4)] }, visible: false }
  ])
  const removed = new Set(plan.removed.map((id) => id.localID))
  const clean = records
    .filter((record) => !removed.has(record.guid?.localID ?? -1))
    .map(
      (record) =>
        plan.records.find((patch) => patch.guid?.localID === record.guid?.localID) ?? record
    )
  const instance = interpretInstance(clean, '1:6')
  expect(instance.children[0].properties.visible).toBe(false)
  expect(instance.children[1].properties.textData).toEqual({ characters: 'Keep label' })
  expect(interpretInstance(clean, '1:9').children[0].properties.visible).not.toBe(false)
})

test('cleanup removes invalid swap defaults and choices without deleting a valid button definition', () => {
  const records = [
    ...pages(),
    node(3, 1, {
      type: 'SYMBOL',
      componentPropDefs: [
        { id: guid(90), type: 'INSTANCE_SWAP', initialValue: { guidValue: guid(8) } },
        {
          id: guid(91),
          type: 'INSTANCE_SWAP',
          initialValue: { guidValue: guid(7) },
          preferredValues: { instanceSwapValues: [{ key: 'removed' }, { key: 'valid' }] }
        }
      ]
    }),
    node(4, 3, {
      type: 'INSTANCE',
      symbolData: { symbolID: guid(7) },
      componentPropRefs: [{ defID: guid(90), componentPropNodeField: 'OVERRIDDEN_SYMBOL_ID' }]
    }),
    node(5, 3, { type: 'TEXT', name: 'Kept label' }),
    node(6, 1, { type: 'INSTANCE', symbolData: { symbolID: guid(3) } }),
    node(7, 1, { type: 'SYMBOL', key: 'valid' }),
    node(8, 2, { type: 'SYMBOL', key: 'removed' })
  ]
  const plan = planFigInternalCleanup(records)
  expect(plan.removed.map((id) => id.localID)).toEqual([2, 4, 8])
  expect(plan.records.find((node) => node.guid?.localID === 3)?.componentPropDefs).toEqual([
    {
      id: guid(91),
      type: 'INSTANCE_SWAP',
      initialValue: { guidValue: guid(7) },
      preferredValues: { instanceSwapValues: [{ key: 'valid' }] }
    }
  ])
})

test('an instance swap property pointing at an internal component hides only its bound nested icon', () => {
  const records = [
    ...pages(),
    node(3, 1, {
      type: 'SYMBOL',
      componentPropDefs: [
        { id: guid(90), type: 'INSTANCE_SWAP', initialValue: { guidValue: guid(7) } }
      ]
    }),
    node(4, 3, {
      type: 'INSTANCE',
      symbolData: { symbolID: guid(7) },
      componentPropRefs: [{ defID: guid(90), componentPropNodeField: 'OVERRIDDEN_SYMBOL_ID' }]
    }),
    node(5, 3, { type: 'TEXT', name: 'Kept label' }),
    node(6, 1, {
      type: 'INSTANCE',
      symbolData: { symbolID: guid(3) },
      componentPropAssignments: [
        { defID: guid(90), varValue: { value: { symbolIdValue: { guid: guid(8) } } } }
      ]
    }),
    node(7, 1, { type: 'SYMBOL' }),
    node(8, 2, { type: 'SYMBOL' })
  ]
  const plan = planFigInternalCleanup(records)
  expect(plan.removed.map((id) => id.localID)).toEqual([2, 8])
  const instance = plan.records.find((record) => record.guid?.localID === 6)
  if (!instance) throw new Error('Missing instance patch')
  expect(instance.componentPropAssignments).toEqual([])
  expect(symbolOverridesOf(instance)).toEqual([{ guidPath: { guids: [guid(4)] }, visible: false }])
})

test('full cleanup patches the archive without changing the source and remains clean after another open', () => {
  const records = [
    ...pages(),
    node(3, 1, { type: 'SYMBOL', name: 'Keep' }),
    node(4, 2, { type: 'SYMBOL' }),
    node(5, 1, { type: 'INSTANCE', symbolData: { symbolID: guid(4) } })
  ]
  const bytes = writeFigArchive({
    schemaDeflated: deflateSync(getSchemaBytes()),
    kiwiData: getCompiledSchema().encodeMessage({ nodeChanges: records, blobs: [] }),
    thumbnailPNG: new Uint8Array(),
    metaJSON: '{"name":"Original"}'
  })
  const original = bytes.slice()
  const prepared = prepareFigComponentCleanup(bytes.buffer)
  expect(prepared.options.internal).toMatchObject({
    canvasCount: 1,
    componentCount: 1,
    instanceCount: 1
  })
  const cleaned = prepared.apply('internal')
  expect(parseFigBuffer(cleaned.buffer).nodeChanges.map((node) => node.guid?.localID)).toEqual([
    0, 1, 3
  ])
  expect(prepareFigComponentCleanup(cleaned.buffer).options.internal.nodeCount).toBe(0)
  expect(bytes).toEqual(original)
})

test('a missing nested replacement is cleaned even without an internal page or deleted records', () => {
  const records = [
    ...pages().filter((record) => !record.internalOnly),
    node(3, 1, { type: 'SYMBOL', name: 'Keep button' }),
    node(4, 3, { type: 'INSTANCE', symbolData: { symbolID: guid(7) } }),
    node(5, 3, { type: 'TEXT', textData: { characters: 'Keep label' } }),
    node(6, 1, {
      type: 'INSTANCE',
      symbolData: {
        symbolID: guid(3),
        symbolOverrides: [{ guidPath: { guids: [guid(4)] }, overriddenSymbolID: guid(99) }]
      }
    }),
    node(7, 1, { type: 'SYMBOL', name: 'Valid default icon' })
  ]
  const bytes = writeFigArchive({
    schemaDeflated: deflateSync(getSchemaBytes()),
    kiwiData: getCompiledSchema().encodeMessage({ nodeChanges: records, blobs: [] }),
    thumbnailPNG: new Uint8Array(),
    metaJSON: '{}'
  })
  const prepared = prepareFigComponentCleanup(bytes.buffer)
  expect(prepared.options.internal).toMatchObject({
    canvasCount: 0,
    nodeCount: 1,
    hiddenInstanceCount: 1
  })
  const cleaned = prepared.apply('internal')
  const instance = interpretInstance(parseFigBuffer(cleaned.buffer).nodeChanges, '1:6')
  expect(instance.children[0].properties.visible).toBe(false)
  expect(instance.children[1].properties.textData).toEqual({ characters: 'Keep label' })
  expect(prepareFigComponentCleanup(cleaned.buffer).options.internal.nodeCount).toBe(0)
})

test('full cleanup removes empty internal pages and assigned slot content, retaining normal defaults', () => {
  const records = [
    ...pages(),
    node(3, 0, { type: 'CANVAS', internalOnly: true }),
    node(4, 1, { type: 'SYMBOL' }),
    node(5, 4, { name: 'Default slot content' }),
    node(6, 1, {
      type: 'INSTANCE',
      symbolData: { symbolID: guid(4) },
      componentPropAssignments: [
        { defID: guid(90), varValue: { value: { slotContentIdValue: { guid: guid(7) } } } }
      ]
    }),
    node(7, 2, { name: 'Assigned slot content' }),
    node(8, 7, { type: 'TEXT' })
  ]
  const plan = planFigInternalCleanup(records)
  expect(plan.canvasCount).toBe(2)
  expect(plan.removed.map((id) => id.localID)).toEqual([2, 3, 7, 8])
  expect(plan.records.find((node) => node.guid?.localID === 6)?.componentPropAssignments).toEqual(
    []
  )
  expect(plan.removed).not.toContainEqual(guid(5))
})
