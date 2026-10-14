import { exportFigFile } from '@open-pencil/core/io'
import type { SceneGraph } from '@open-pencil/scene-graph'
import { parseSVGPath } from '@open-pencil/scene-graph/parse-path'

/** A saved icon from the older generator: every path inherited the SVG viewBox. */
export async function createOversizedVectorFile(graph: SceneGraph, pageId: string) {
  const frame = graph.createNode('FRAME', pageId, {
    name: 'SVG artwork',
    x: 40,
    y: 50,
    width: 300,
    height: 300,
    fills: [
      { type: 'SOLID', color: { r: 0.95, g: 0.95, b: 0.95, a: 1 }, opacity: 1, visible: true }
    ]
  })
  const path = graph.createNode('VECTOR', frame.id, {
    name: 'Coverage path',
    fills: [
      {
        type: 'GRADIENT_LINEAR',
        color: { r: 0, g: 0, b: 0, a: 1 },
        gradientTransform: { m00: 1, m01: 0, m02: 0, m10: 0, m11: 1, m12: 0 },
        gradientStops: [
          { position: 0, color: { r: 0.1, g: 0.4, b: 0.8, a: 1 } },
          { position: 1, color: { r: 0.6, g: 0.15, b: 0.75, a: 1 } }
        ],
        opacity: 1,
        visible: true
      }
    ]
  })
  graph.preserveSourceMetadataDuring(() =>
    graph.updateNode(path.id, {
      width: 300,
      height: 300,
      vectorNetwork: parseSVGPath('M60 100 H180 V200 H60 Z')
    })
  )
  return exportFigFile(graph)
}
