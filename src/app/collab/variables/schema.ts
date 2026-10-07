import * as v from 'valibot'

import {
  TOKEN_UNITS,
  VARIABLE_SCOPES,
  type Variable,
  type VariableCollection
} from '@open-pencil/scene-graph'

const finite = v.pipe(v.number(), v.finite())
const color = v.object({ r: finite, g: finite, b: finite, a: finite })
const alias = v.object({ aliasId: v.string() })
const value = v.union([color, finite, v.string(), v.boolean(), alias])
const pluginData = v.array(v.object({ pluginId: v.string(), key: v.string(), value: v.string() }))

export const variableSchema: v.GenericSchema<unknown, Variable> = v.object({
  id: v.string(),
  name: v.string(),
  type: v.picklist(['COLOR', 'FLOAT', 'STRING', 'BOOLEAN']),
  collectionId: v.string(),
  valuesByMode: v.record(v.string(), value),
  description: v.string(),
  hiddenFromPublishing: v.boolean(),
  scopes: v.optional(v.array(v.picklist(VARIABLE_SCOPES))),
  codeSyntax: v.optional(
    v.object({
      WEB: v.optional(v.string()),
      ANDROID: v.optional(v.string()),
      iOS: v.optional(v.string())
    })
  ),
  unit: v.optional(v.picklist(TOKEN_UNITS)),
  expressions: v.optional(v.record(v.string(), v.object({ css: v.string(), resolved: finite }))),
  pluginData: v.optional(pluginData),
  key: v.optional(v.string()),
  version: v.optional(v.string())
})

export const collectionSchema: v.GenericSchema<unknown, VariableCollection> = v.object({
  id: v.string(),
  name: v.string(),
  modes: v.pipe(
    v.array(
      v.object({
        modeId: v.string(),
        name: v.string(),
        condition: v.optional(v.string())
      })
    ),
    v.minLength(1)
  ),
  modeAttribute: v.optional(v.string()),
  defaultModeId: v.string(),
  variableIds: v.array(v.string()),
  pluginData: v.optional(pluginData)
})
