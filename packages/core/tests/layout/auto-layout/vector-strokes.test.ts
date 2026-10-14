import { expect, test } from 'bun:test'

import { SceneGraph } from '@open-pencil/scene-graph'
import { copyStrokes } from '@open-pencil/scene-graph/copy'
import { parseSVGPath } from '@open-pencil/scene-graph/parse-path'
import { regenerateFillGeometry } from '@open-pencil/scene-graph/vector-network'

import { computeAllLayouts } from '#core/layout'

for (const preview of [false, true]) {
  test(`layout preserves vector stroke weight through repeated resizing${preview ? ' in preview' : ''}`, () => {
    const graph = new SceneGraph()
    const frame = graph.createNode('FRAME', graph.getPages()[0].id, {
      width: 14,
      height: 120,
      layoutMode: 'VERTICAL',
      primaryAxisSizing: 'FIXED',
      counterAxisSizing: 'FIXED'
    })
    // A nearly vertical endpoint from an imported measurement annotation.
    const network = parseSVGPath('M0.000000685453463 0 L0.000000685453463 7 L0 14')
    const endpoint = graph.createNode('VECTOR', frame.id, {
      vectorNetwork: network,
      rotation: -90,
      layoutAlignSelf: 'STRETCH',
      strokeStyleId: 'annotation-stroke',
      strokeGeometry: regenerateFillGeometry(parseSVGPath('M-0.5 0 H0.5 V14 H-0.5 Z'), [
        { windingRule: 'NONZERO', commandsBlob: new Uint8Array() }
      ]),
      strokes: [
        {
          type: 'SOLID',
          color: { r: 1, g: 0.33, b: 0.29, a: 1 },
          weight: 1,
          opacity: 1,
          visible: true,
          align: 'CENTER',
          dashPattern: [4, 4]
        }
      ]
    })
    const stroke = copyStrokes(endpoint.strokes)
    const run = () => {
      for (const width of [14, 28, 7, 14]) {
        graph.updateNode(frame.id, { width })
        computeAllLayouts(graph)
        expect(endpoint.strokes).toEqual(stroke)
        expect(endpoint.strokeStyleId).toBe('annotation-stroke')
        expect(endpoint.strokeGeometry).toEqual([])
      }
    }
    if (preview) graph.runPreviewUpdates(run)
    else run()
  })
}
