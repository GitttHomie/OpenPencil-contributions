import { expect, test } from 'bun:test'

import { expectDefined } from '#core-tests/helpers/assert'

import { SceneGraph } from '@open-pencil/scene-graph'

import {
  captureClipboardVariables,
  importClipboardVariables,
  remapClipboardVariableBindings
} from '#core/editor/clipboard/variables'

test('copying component property defaults and assignments carries and remaps their variables', () => {
  const source = new SceneGraph()
  const target = new SceneGraph()
  const collection = source.createCollection('Flags')
  const variable = source.createVariable('Show', 'BOOLEAN', collection.id, true)
  const component = source.createNode('COMPONENT', source.getPages()[0].id, {
    componentPropertyDefinitions: [
      {
        id: 'show',
        name: 'Show',
        type: 'BOOLEAN',
        defaultValue: 'true',
        defaultVariableId: variable.id
      }
    ]
  })
  const nested = source.createNode('INSTANCE', component.id, {
    componentPropertyVariableAssignments: { show: variable.id }
  })
  const captured = captureClipboardVariables(source, [component, nested])
  expect(captured.variables.map((value) => value.id)).toEqual([variable.id])
  const transfer = importClipboardVariables(target, captured)
  transfer.apply()
  const copied = target.createNode('COMPONENT', target.getPages()[0].id, {
    componentPropertyDefinitions: structuredClone(component.componentPropertyDefinitions)
  })
  const instance = target.createNode('INSTANCE', copied.id, {
    componentPropertyVariableAssignments: { ...nested.componentPropertyVariableAssignments }
  })
  for (const node of [copied, instance])
    remapClipboardVariableBindings(
      node,
      transfer.variableIds,
      transfer.collectionIds,
      transfer.modeIds
    )
  const mapped = expectDefined(transfer.variableIds.get(variable.id))
  expect(mapped).toBeDefined()
  expect(mapped).not.toBe(variable.id)
  expect(copied.componentPropertyDefinitions[0].defaultVariableId).toBe(mapped)
  expect(instance.componentPropertyVariableAssignments.show).toBe(mapped)
  expect(component.componentPropertyDefinitions[0].defaultVariableId).toBe(variable.id)
  expect(nested.componentPropertyVariableAssignments.show).toBe(variable.id)
})
