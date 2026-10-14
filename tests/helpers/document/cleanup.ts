import { deflateSync } from 'fflate'

import { writeFigArchive } from '@open-pencil/fig'
import {
  getCompiledSchema,
  getSchemaBytes,
  initCodec,
  type NodeChange
} from '@open-pencil/kiwi/fig/codec'

/** A visible presentation component, a used embedded definition and an optional orphan. */
export async function cleanupFixture(orphan = true, internal = true): Promise<Uint8Array> {
  await initCodec()
  const guid = (localID: number) => ({ sessionID: 1, localID })
  const node = (id: number, parent: number, type: string, name: string): NodeChange => ({
    guid: guid(id),
    parentIndex: { guid: guid(parent), position: String(id) },
    type,
    name,
    visible: true,
    opacity: 1,
    size: { x: 100, y: 40 },
    transform: { m00: 1, m01: 0, m02: 0, m10: 0, m11: 1, m12: 0 }
  })
  const records: NodeChange[] = [
    { guid: guid(0), type: 'DOCUMENT', name: 'Cleanup test' },
    node(1, 0, 'CANVAS', 'Designs'),
    { ...node(2, 0, 'CANVAS', 'Internal Only Canvas'), internalOnly: true },
    node(3, 1, 'SYMBOL', 'Presentation component'),
    node(4, 2, 'SYMBOL', 'Used embedded component'),
    { ...node(5, 1, 'INSTANCE', 'Used instance'), symbolData: { symbolID: guid(4) } },
    {
      ...node(12, 1, 'FRAME', 'Button variants'),
      isStateGroup: true,
      componentPropDefs: [
        { id: guid(90), name: 'Icon', type: 'INSTANCE_SWAP', initialValue: { guidValue: guid(4) } }
      ]
    },
    {
      ...node(8, 12, 'SYMBOL', 'Valid button'),
      componentPropDefs: [{ id: guid(91), parentPropDefId: guid(90) }]
    },
    node(9, 8, 'RECTANGLE', 'Button label'),
    {
      ...node(10, 8, 'INSTANCE', 'Nested icon'),
      symbolData: { symbolID: guid(4) },
      componentPropRefs: [{ defID: guid(91), componentPropNodeField: 'OVERRIDDEN_SYMBOL_ID' }]
    },
    { ...node(11, 1, 'INSTANCE', 'Button instance'), symbolData: { symbolID: guid(8) } },
    ...(orphan
      ? [
          node(6, 2, 'SYMBOL', 'Unused embedded component'),
          node(7, 6, 'RECTANGLE', 'Orphan content')
        ]
      : [])
  ]
  return writeFigArchive({
    schemaDeflated: deflateSync(getSchemaBytes()),
    kiwiData: getCompiledSchema().encodeMessage({
      nodeChanges: internal
        ? records
        : records
            .filter((node) => node.guid?.localID !== 2)
            .map((node) =>
              node.parentIndex?.guid.localID === 2
                ? { ...node, parentIndex: { ...node.parentIndex, guid: guid(1) } }
                : node
            ),
      blobs: []
    }),
    thumbnailPNG: new Uint8Array(),
    metaJSON: '{"fileName":"Cleanup test"}'
  })
}
