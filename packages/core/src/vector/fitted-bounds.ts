import { fittedVectorChanges, type SceneGraph } from '@open-pencil/scene-graph'

/** Materialized paths get geometric bounds; their surrounding SVG frames retain the viewBox. */
export function fitImportedVectorBounds(graph: SceneGraph): void {
  graph.preserveSourceMetadataDuring(() => {
    for (const node of graph.getAllNodes()) {
      const changes = fittedVectorChanges(node)
      if (Object.keys(changes).length === 0) continue
      graph.updateNode(node.id, {
        ...changes,
        source: {
          ...node.source,
          editedFields: [
            ...new Set([
              ...node.source.editedFields,
              ...Object.keys(changes).filter((key) => key !== 'derivedLayout')
            ])
          ]
        }
      })
    }
  })
}
