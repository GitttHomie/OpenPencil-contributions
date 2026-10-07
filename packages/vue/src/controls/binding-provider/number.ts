import type { Editor } from '@open-pencil/core/editor'
import { randomHex } from '@open-pencil/core/random'
import type { VariableCollection } from '@open-pencil/scene-graph'

import { useOpenPencilBindingProvider } from '#vue/controls/binding-provider/open-pencil'
import type { BindingTarget } from '#vue/controls/binding-provider/types'
import {
  numberBindingTarget,
  prepareNumberTargets
} from '#vue/controls/number-variable-binding/groups'

import { prepareModeEdit } from './mode-edit'
import { resolveEffectiveBindingValue } from './resolution'

const FALLBACK_NUMBER_VARIABLE_NAME = 'New number'

function numberCollection(editor: Editor): VariableCollection {
  const existing = editor
    .getCollections()
    .find((collection) =>
      collection.variableIds.some((variableId) => editor.getVariable(variableId)?.type === 'FLOAT')
    )
  if (existing) return existing

  const collection: VariableCollection = {
    id: `col:${randomHex(8)}`,
    name: 'Numbers',
    modes: [{ modeId: 'default', name: 'Mode 1' }],
    defaultModeId: 'default',
    variableIds: []
  }
  editor.addCollection(collection)
  return collection
}

export function createAndBindNumberVariable(
  editor: Editor,
  target: BindingTarget,
  value: number,
  name = FALLBACK_NUMBER_VARIABLE_NAME
) {
  const collection = numberCollection(editor)
  const id = `var:${randomHex(8)}`
  editor.addVariable({
    id,
    name: name.trim() || FALLBACK_NUMBER_VARIABLE_NAME,
    type: 'FLOAT',
    collectionId: collection.id,
    valuesByMode: Object.fromEntries(collection.modes.map((mode) => [mode.modeId, value])),
    description: '',
    hiddenFromPublishing: false
  })
  editor.bindVariable(target.nodeId, target.path, id)
}

function resolveNumber(editor: Editor, id: string, target?: BindingTarget) {
  const value = target
    ? resolveEffectiveBindingValue(editor, id, target)
    : editor.resolveNumberVariable(id)
  if (typeof value !== 'number') return undefined
  return (
    value * (target ? (editor.getNode(target.nodeId)?.variableBindingScales[target.path] ?? 1) : 1)
  )
}

export function useNumberBindingProvider() {
  return useOpenPencilBindingProvider<number>({
    type: 'FLOAT',
    bindingTarget: numberBindingTarget,
    prepareTargets: prepareNumberTargets,
    resolve: resolveNumber,
    prepareEdit: (editor, id, target) =>
      prepareModeEdit(editor, id, target, () => resolveNumber(editor, id, target)),
    create: createAndBindNumberVariable
  })
}
