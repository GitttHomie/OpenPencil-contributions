import type { SceneNode } from '@open-pencil/scene-graph'

import { createComponentAuthoringActions } from './components/authoring'
import { createBehaviourActions } from './components/behaviours'
import { becomesComponent, componentWrapProps } from './components/create'
import { createComponentFocusActions } from './components/focus'
import { createComponentInstanceActions } from './components/instances'
import { createNestedPropertyActions } from './components/nested-properties'
import { createComponentPropertyActions } from './components/properties'
import { createSlotActions } from './components/slots'
import { createSlotAuthoringActions } from './components/slots/authoring'
import { createVariantActions } from './components/variants'
import { createVariantSet } from './components/variants/wrap'
import type { EditorContext } from './types'

export function createComponentActions(
  ctx: EditorContext,
  wrapInAutoLayout: (nodes: SceneNode[]) => string | null | undefined
) {
  function createComponentFromSelection(
    selectedNodes: SceneNode[],
    wrapSelectionInContainer: (
      type: 'GROUP' | 'FRAME' | 'COMPONENT' | 'COMPONENT_SET',
      nodes: SceneNode[],
      extra?: Partial<SceneNode>
    ) => string | null
  ) {
    if (selectedNodes.length === 0) return

    const prevSelection = new Set(ctx.state.selectedIds)

    if (selectedNodes.length === 1) {
      const node = selectedNodes[0]
      const prevType = node.type

      if (node.type === 'COMPONENT') return

      if (becomesComponent(node)) {
        ctx.graph.updateNode(node.id, { type: 'COMPONENT' })
        ctx.setSelectedIds(new Set([node.id]))
        ctx.undo.push({
          label: 'Create component',
          forward: () => {
            ctx.graph.updateNode(node.id, { type: 'COMPONENT' })
            ctx.setSelectedIds(new Set([node.id]))
          },
          inverse: () => {
            ctx.graph.updateNode(node.id, { type: prevType })
            ctx.setSelectedIds(prevSelection)
          }
        })
        return
      }
    }

    wrapSelectionInContainer('COMPONENT', selectedNodes, componentWrapProps(selectedNodes))
  }

  function createComponentSetFromComponents(selectedNodes: SceneNode[]) {
    if (selectedNodes.length < 2) return
    createVariantSet(ctx, selectedNodes)
  }

  const focusActions = createComponentFocusActions(ctx)
  const instanceActions = createComponentInstanceActions(ctx)
  const variantActions = createVariantActions(ctx)
  const componentPropertyActions = createComponentPropertyActions(
    ctx,
    variantActions.switchInstanceVariant
  )

  return {
    createComponentFromSelection,
    createComponentSetFromComponents,
    ...instanceActions,
    ...focusActions,
    ...variantActions,
    ...componentPropertyActions,
    ...createNestedPropertyActions(
      ctx,
      componentPropertyActions.getInstanceComponentPropertyDefinitions
    ),
    ...createComponentAuthoringActions(ctx, componentPropertyActions.setInstanceComponentProperty),
    ...createSlotActions(ctx),
    ...createSlotAuthoringActions(ctx, wrapInAutoLayout),
    ...createBehaviourActions(ctx, variantActions)
  }
}
