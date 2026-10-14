import type { SceneGraph } from '@open-pencil/scene-graph'

export function createHugColumnFooter(graph: SceneGraph, parentId: string) {
  const footer = graph.createNode('COMPONENT', parentId, {
    name: 'Footer',
    x: 32,
    y: 32,
    width: 600,
    height: 100,
    layoutMode: 'HORIZONTAL',
    primaryAxisSizing: 'FIXED',
    counterAxisSizing: 'HUG',
    primaryAxisAlign: 'SPACE_BETWEEN',
    paddingTop: 24,
    paddingBottom: 24,
    paddingLeft: 24,
    paddingRight: 24,
    fills: [
      { type: 'SOLID', color: { r: 0.12, g: 0.15, b: 0.18, a: 1 }, visible: true, opacity: 1 }
    ],
    clipsContent: true
  })
  for (const labels of [
    ['Company', 'About us'],
    ['Support', 'Installation'],
    ['Products', 'Wired camera']
  ]) {
    const column = graph.createNode('FRAME', footer.id, {
      name: labels[0],
      width: 600,
      height: 60,
      layoutMode: 'VERTICAL',
      primaryAxisSizing: 'HUG',
      counterAxisSizing: 'HUG',
      itemSpacing: 12
    })
    for (const text of labels)
      graph.createNode('TEXT', column.id, {
        name: text,
        text,
        width: 600,
        height: 20,
        textAutoResize: 'HEIGHT',
        layoutAlignSelf: 'STRETCH',
        fontFamily: 'Inter',
        fontSize: 16,
        fills: [{ type: 'SOLID', color: { r: 1, g: 1, b: 1, a: 1 }, visible: true, opacity: 1 }]
      })
  }
  const instance = graph.createInstance(footer.id, parentId, { x: 32, y: 180 })
  if (!instance) throw new Error('Footer instance missing')
  return [footer.id, instance.id]
}
