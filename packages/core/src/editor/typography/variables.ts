import type { SceneNode, Variable, VariableCollection } from '@open-pencil/scene-graph'

import type { createNodeActions } from '#core/editor/nodes'
import type { EditorContext } from '#core/editor/types'
import type { createVariableActions } from '#core/editor/variables'
import { fontManager } from '#core/text/fonts'

export function createFontVariableActions(
  ctx: EditorContext,
  variables: ReturnType<typeof createVariableActions>,
  nodes: ReturnType<typeof createNodeActions>
) {
  function createFontVariable(
    nodeId: string,
    field: 'fontFamily' | 'fontWeight',
    name: string
  ): string {
    const node = ctx.graph.getNode(nodeId)
    if (node?.type !== 'TEXT' || !name.trim())
      throw new Error('Choose a text layer and a variable name.')
    if (
      field === 'fontWeight' &&
      !fontManager.offersFace(node.fontFamily, node.fontWeight, node.italic)
    )
      throw new Error('This font family does not have the selected weight.')
    return ctx.undo.runBatch('Create font variable', () => {
      let family = ctx.graph.variables.get(node.boundVariables.fontFamily)
      let collection = family && ctx.graph.variableCollections.get(family.collectionId)
      if (!collection) collection = typographyCollection()
      if (field === 'fontFamily') {
        family = add(collection, node.fontFamily, name.trim())
        nodes.bindVariable(node.id, field, family.id)
        return family.id
      }
      if (!family) family = add(collection, node.fontFamily, `${name.trim()} / Family`)
      const weight = add(collection, node.fontWeight, name.trim(), family.id)
      nodes.bindVariable(node.id, field, weight.id)
      return weight.id
    })
  }
  function typographyCollection(): VariableCollection {
    const existing = variables
      .getCollections()
      .find((collection) =>
        collection.variableIds.some((id) =>
          variables.getVariable(id)?.scopes?.includes('FONT_FAMILY')
        )
      )
    if (existing) return existing
    const collection: VariableCollection = {
      id: crypto.randomUUID(),
      name: 'Typography',
      modes: [{ modeId: 'default', name: 'Default' }],
      defaultModeId: 'default',
      variableIds: []
    }
    variables.addCollection(collection)
    return collection
  }
  function add(
    collection: VariableCollection,
    value: SceneNode['fontFamily'] | SceneNode['fontWeight'],
    name: string,
    familyId?: string
  ): Variable {
    const variable: Variable = {
      id: crypto.randomUUID(),
      name,
      type: typeof value === 'number' ? 'FLOAT' : 'STRING',
      collectionId: collection.id,
      valuesByMode: Object.fromEntries(collection.modes.map((mode) => [mode.modeId, value])),
      description: '',
      hiddenFromPublishing: false,
      scopes: [typeof value === 'number' ? 'FONT_STYLE' : 'FONT_FAMILY'],
      unit: typeof value === 'number' ? 'none' : undefined,
      fontFamilyVariableId: familyId
    }
    variables.addVariable(variable)
    return variable
  }
  return { createFontVariable }
}
