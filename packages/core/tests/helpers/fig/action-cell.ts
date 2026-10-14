import { createEditor } from '#core/editor/create'

/** Saved geometry for a cell whose 30px action makes its content taller than the 44px icon. */
export function createSavedActionCell() {
  const editor = createEditor()
  const graph = editor.graph
  const main = graph.createNode('COMPONENT', editor.state.currentPageId, {
    name: 'Action cell',
    layoutMode: 'VERTICAL',
    primaryAxisSizing: 'HUG',
    counterAxisSizing: 'FIXED',
    width: 262,
    height: 94,
    paddingTop: 12,
    paddingBottom: 12,
    paddingLeft: 24,
    paddingRight: 24,
    derivedLayout: { width: 262, height: 94 },
    componentPropertyDefinitions: [
      { id: 'show-action', name: 'Show action', type: 'BOOLEAN', defaultValue: 'true' }
    ]
  })
  const content = graph.createNode('FRAME', main.id, {
    name: 'Content',
    layoutMode: 'HORIZONTAL',
    primaryAxisSizing: 'FIXED',
    counterAxisSizing: 'HUG',
    layoutAlignSelf: 'STRETCH',
    width: 214,
    height: 70,
    itemSpacing: 12,
    derivedLayout: { x: 24, y: 12, width: 214, height: 70 }
  })
  graph.createNode('FRAME', content.id, { name: 'Icon', width: 44, height: 44 })
  const body = graph.createNode('FRAME', content.id, {
    name: 'Body',
    layoutMode: 'VERTICAL',
    primaryAxisSizing: 'HUG',
    counterAxisSizing: 'FIXED',
    layoutGrow: 1,
    width: 158,
    height: 70,
    itemSpacing: 8,
    derivedLayout: { width: 158, height: 70 }
  })
  graph.createNode('FRAME', body.id, { name: 'Label', width: 158, height: 32 })
  const action = graph.createNode('FRAME', body.id, {
    name: 'Action',
    width: 158,
    height: 30,
    componentPropertyReferences: [{ field: 'VISIBLE', propertyId: 'show-action' }]
  })
  const list = graph.createNode('FRAME', editor.state.currentPageId, {
    name: 'Settings',
    layoutMode: 'VERTICAL',
    primaryAxisSizing: 'HUG',
    counterAxisSizing: 'FIXED',
    width: 262,
    itemSpacing: 8
  })
  return { editor, graph, main, action, list }
}
