import { expect, test } from 'bun:test'

import { guid } from '#fig-tests/helpers/guid'
import { materializeDocument } from '#fig/document/materialize'
import { createDocumentReader } from '#fig/document/read'

import type { NodeChange } from '@open-pencil/kiwi/fig/codec'

test('copies archive images into document-owned resources', () => {
  const bytes = new Uint8Array([1, 2, 3])
  const { graph } = materializeDocument([], [], { images: new Map([['image-hash', bytes]]) })
  expect(graph.images.get('image-hash')).toEqual(bytes)
  bytes[0] = 9
  expect(graph.images.get('image-hash')?.[0]).toBe(1)
})

test('retains distinct collections sharing a library key when membership uses local IDs', () => {
  const resources: NodeChange[] = [1, 2].flatMap((index): NodeChange[] => [
    {
      guid: guid(index),
      type: 'VARIABLE_SET',
      name: `Collection ${index}`,
      key: 'shared-library',
      variableSetModes: [{ id: guid(10 + index), name: 'Default' }]
    },
    {
      guid: guid(20 + index),
      type: 'VARIABLE',
      name: `Value ${index}`,
      variableSetID: { guid: guid(index) },
      variableResolvedType: 'FLOAT',
      variableDataValues: {
        entries: [
          {
            modeID: guid(10 + index),
            variableData: { dataType: 'FLOAT', value: { floatValue: index * 8 } }
          }
        ]
      }
    }
  ])
  const before = structuredClone(resources)
  const { graph } = materializeDocument(resources)
  expect(graph.variableCollections.size).toBe(2)
  expect(graph.variableCollections.get('1:1')?.variableIds).toEqual(['1:21'])
  expect(graph.variableCollections.get('1:2')?.variableIds).toEqual(['1:22'])
  expect(graph.variables.get('1:21')?.valuesByMode).toEqual({ '1:11': 8 })
  expect(graph.variables.get('1:22')?.valuesByMode).toEqual({ '1:12': 16 })
  expect(resources).toEqual(before)
})

test('loads mode values without treating false, zero or empty text as missing', () => {
  const mode = guid(10)
  const collection = guid(3)
  const resources: NodeChange[] = [
    { guid: collection, type: 'VARIABLE_SET', variableSetModes: [{ id: mode, name: 'Default' }] },
    ...(['BOOLEAN', 'FLOAT', 'STRING'] as const).map((type, index) => ({
      guid: guid(4 + index),
      type: 'VARIABLE' as const,
      variableResolvedType: type,
      variableSetID: { guid: collection },
      variableDataValues: {
        entries: [
          {
            modeID: mode,
            variableData: {
              dataType: type,
              value: {
                BOOLEAN: { boolValue: false },
                FLOAT: { floatValue: 0 },
                STRING: { textValue: '' }
              }[type]
            }
          }
        ]
      }
    }))
  ]
  const { graph } = materializeDocument(resources)
  expect([...graph.variables.values()].map((variable) => variable.valuesByMode['1:10'])).toEqual([
    false,
    0,
    ''
  ])
  expect(graph.variableCollections.get('1:3')?.variableIds).toEqual(['1:4', '1:5', '1:6'])
})

test('keeps variable resources outside scene pages and rejects silent omission', () => {
  const changes: NodeChange[] = [
    { guid: guid(1), type: 'DOCUMENT' },
    { guid: guid(2), type: 'CANVAS', parentIndex: { guid: guid(1), position: '!' } },
    { guid: guid(3), type: 'VARIABLE_SET', parentIndex: { guid: guid(2), position: '!' } },
    { guid: guid(4), type: 'VARIABLE', parentIndex: { guid: guid(3), position: '!' } }
  ]
  const reader = createDocumentReader(changes)
  expect(reader.resources.map((node) => node.type)).toEqual(['VARIABLE_SET', 'VARIABLE'])
  expect(reader.readPage('1:2').children).toEqual([])
  expect(() => materializeDocument(changes)).toThrow('Unsupported document resource')
  const reported: NodeChange[] = []
  const { graph } = materializeDocument(changes, [], {
    onUnsupportedResource: (node) => reported.push(node)
  })
  expect(reported).toHaveLength(2)
  expect(graph.getChildren(graph.getPages()[0].id)).toEqual([])
})

test('imports color expressions symbolically and rejects malformed or unsupported expressions', () => {
  const collection = guid(3)
  const mode = guid(10)
  const changes: NodeChange[] = [
    { guid: collection, type: 'VARIABLE_SET', variableSetModes: [{ id: mode, name: 'Default' }] },
    {
      guid: guid(4),
      type: 'VARIABLE',
      name: 'Alpha',
      variableResolvedType: 'COLOR',
      variableSetID: { guid: collection },
      variableDataValues: {
        entries: [
          {
            modeID: mode,
            variableData: {
              dataType: 'EXPRESSION',
              resolvedDataType: 'COLOR',
              value: {
                expressionValue: {
                  expressionFunction: 'COMPOSE_COLOR',
                  expressionArguments: [
                    { dataType: 'ALIAS', value: { alias: { guid: guid(5) } } },
                    { dataType: 'FLOAT', value: { floatValue: 20 } }
                  ]
                }
              }
            }
          }
        ]
      }
    }
  ]
  const { graph } = materializeDocument(changes)
  expect(graph.variables.get('1:4')?.valuesByMode['1:10']).toEqual({
    expression: 'COMPOSE_COLOR',
    color: { aliasId: '1:5' },
    opacity: 20
  })
  // The missing base remains unresolved rather than becoming black or losing its reference.
  expect(graph.resolveColorVariable('1:4')).toBeUndefined()
  const expression = changes[1].variableDataValues?.entries[0].variableData.value?.expressionValue
  if (!expression) throw new Error('Missing fixture expression')
  expression.expressionFunction = 'ADDITION'
  expect(() => materializeDocument(changes)).toThrow('Expression result type does not match COLOR')
  expression.expressionFunction = 'ROUND'
  expect(() => materializeDocument(changes)).toThrow('Unsupported variable expression ROUND')
  expression.expressionFunction = 'COMPOSE_COLOR'
  expression.expressionArguments = [
    { dataType: 'STRING', value: { textValue: 'red' } },
    { dataType: 'FLOAT', value: { floatValue: 20 } }
  ]
  expect(() => materializeDocument(changes)).toThrow('Invalid COMPOSE_COLOR operands')
  expression.expressionArguments = []
  expect(() => materializeDocument(changes)).toThrow('Unsupported variable expression')
})
