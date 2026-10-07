import { describe, expect, test } from 'bun:test'

import { omit } from 'es-toolkit'
import { computed, ref } from 'vue'

import { createEditor } from '@open-pencil/core/editor'
import {
  BORDER_WIDTH_PATHS,
  CORNER_RADIUS_PATHS,
  numberPropertyValue
} from '@open-pencil/scene-graph'

import { createAppearanceActions, createAppearanceState } from '#vue/controls/appearance/helpers'
import { createOpenPencilBindingProvider } from '#vue/controls/binding-provider/open-pencil'
import { MIXED } from '#vue/controls/node-props/use'
import {
  numberBindingTarget,
  prepareNumberTargets
} from '#vue/controls/number-variable-binding/groups'
import { createNumberPropertyActions } from '#vue/controls/number-variable-binding/property'

function fixture() {
  const editor = createEditor()
  const page = editor.graph.getPages()[0]
  if (!page) throw new Error('Missing page')
  const collection = editor.graph.createCollection('Spacing')
  const variable = editor.graph.createVariable('Medium', 'FLOAT', collection.id, 16)
  const node = editor.graph.createNode('FRAME', page.id, {
    cornerRadius: 16,
    strokes: [
      { weight: 2, color: { r: 0, g: 0, b: 0, a: 1 }, opacity: 1, visible: true, align: 'INSIDE' }
    ]
  })
  const provider = createOpenPencilBindingProvider(editor, {
    type: 'FLOAT',
    bindingTarget: numberBindingTarget,
    prepareTargets: prepareNumberTargets,
    resolve: (editor, id, target) =>
      target
        ? editor.graph.resolveNumberVariableForNode(target.nodeId, id)
        : editor.resolveNumberVariable(id)
  })
  return { editor, node, provider, variable, collection }
}

describe('grouped numeric properties', () => {
  test('expanding and collapsing uniform or independent corners never changes storage or history', () => {
    const { editor, node } = fixture()
    const options = {
      editor,
      node: computed(() => node),
      nodes: computed(() => [node]),
      isMulti: computed(() => false),
      merged: () => MIXED,
      expandedCornerNodeId: ref<string | null>(null),
      collapsedCornerNodeId: ref<string | null>(null)
    }
    const state = createAppearanceState(options)
    const actions = createAppearanceActions(options)
    for (const independent of [false, true]) {
      editor.graph.updateNode(node.id, { independentCorners: independent })
      const before = structuredClone(node)
      actions.toggleIndependentCorners()
      expect(state.showIndependentCorners.value).toBe(true)
      actions.toggleIndependentCorners()
      expect(state.showIndependentCorners.value).toBe(false)
      expect(omit(node, ['source'])).toEqual(omit(before, ['source']))
      expect(editor.undo.canUndo).toBe(false)
    }
  })

  test('a uniform token appears on every corner; detaching one preserves the others and undoes atomically', () => {
    const { editor, node, provider, variable } = fixture()
    editor.bindVariable(node.id, 'cornerRadius', variable.id)
    const before = structuredClone(node)
    const targets = CORNER_RADIUS_PATHS.map((path) => ({ nodeId: node.id, path }))
    expect(targets.map((target) => provider.getBindingId(target))).toEqual(
      CORNER_RADIUS_PATHS.map(() => variable.id)
    )
    editor.undo.runBatch('Detach top left', () => {
      prepareNumberTargets(editor, targets.slice(0, 1))
      provider.unbind(targets[0])
    })
    expect(targets.map((target) => provider.getBindingId(target))).toEqual([
      undefined,
      variable.id,
      variable.id,
      variable.id
    ])
    expect(targets.map((target) => numberPropertyValue(node, target.path))).toEqual([
      16, 16, 16, 16
    ])
    expect(provider.getState(targets)).toBe('mixed')
    editor.undo.undo()
    expect(omit(node, ['source'])).toEqual(omit(before, ['source']))
    editor.undo.redo()
    editor.updateVariableValue(variable.id, Object.keys(variable.valuesByMode)[0], 24)
    expect(targets.map((target) => numberPropertyValue(node, target.path))).toEqual([
      16, 24, 24, 24
    ])
  })

  test('mixed group edits restore all distinct numbers and bindings in one undo', () => {
    const { editor, node, variable } = fixture()
    editor.graph.updateNode(node.id, { paddingLeft: 16, paddingRight: 40 })
    editor.bindVariable(node.id, 'paddingLeft', variable.id)
    const before = structuredClone(node)
    const targets = computed(() =>
      ['paddingLeft', 'paddingRight'].map((path) => ({ nodeId: node.id, path }))
    )
    const actions = createNumberPropertyActions(editor, targets)
    editor.undo.beginBatch('Group edit')
    for (const target of targets.value) editor.unbindVariable(target.nodeId, target.path)
    actions.update(8)
    actions.commit()
    editor.undo.commitBatch()
    expect([node.paddingLeft, node.paddingRight]).toEqual([8, 8])
    editor.undo.undo()
    expect(omit(node, ['source'])).toEqual(omit(before, ['source']))
  })

  test('individual border editing retains the other shared widths and cancels exactly', () => {
    const { editor, node } = fixture()
    const before = structuredClone(node)
    expect(BORDER_WIDTH_PATHS.map((path) => numberPropertyValue(node, path))).toEqual([2, 2, 2, 2])
    const targets = computed(() => [{ nodeId: node.id, path: 'borderTopWeight' }])
    const actions = createNumberPropertyActions(editor, targets)
    editor.undo.beginBatch('Border edit')
    prepareNumberTargets(editor, targets.value)
    actions.update(10)
    expect(BORDER_WIDTH_PATHS.map((path) => numberPropertyValue(node, path))).toEqual([10, 2, 2, 2])
    actions.cancel()
    editor.undo.rollbackBatch()
    expect(omit(node, ['source'])).toEqual(omit(before, ['source']))
  })

  test('editing instance corners leaves the definition unchanged and undo restores overrides', () => {
    const { editor, node, variable } = fixture()
    editor.graph.updateNode(node.id, { type: 'COMPONENT' })
    editor.bindVariable(node.id, 'cornerRadius', variable.id)
    const instance = editor.graph.createInstance(node.id, node.parentId)
    if (!instance) throw new Error('Missing instance')
    const before = structuredClone(instance)
    const definition = structuredClone(node)
    const target = { nodeId: instance.id, path: 'topLeftRadius' }
    editor.undo.runBatch('Detach instance corner', () => {
      prepareNumberTargets(editor, [target])
      editor.unbindVariable(instance.id, target.path)
    })
    expect(node).toEqual(definition)
    expect(instance.boundVariables.topRightRadius).toBe(variable.id)
    editor.undo.undo()
    expect(omit(instance, ['source'])).toEqual(omit(before, ['source']))
  })
})
