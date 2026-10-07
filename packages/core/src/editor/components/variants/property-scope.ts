import {
  OPEN_PENCIL_PLUGIN_DATA,
  readPluginData,
  withPluginData,
  type SceneNode
} from '@open-pencil/scene-graph'

import { assertNodeEditable } from '#core/editor/capabilities'
import type { EditorContext } from '#core/editor/types'

/** A duplicated variant shares its property identities; local defaults remain on each variant. */
export function shareVariantProperties(ctx: EditorContext, source: SceneNode, set: SceneNode) {
  const properties = source.componentPropertyDefinitions.filter((definition) =>
    ['TEXT', 'BOOLEAN', 'INSTANCE_SWAP'].includes(definition.type)
  )
  if (!properties.length) return
  const variants = ctx.graph.getChildren(set.id).filter((node) => node.type === 'COMPONENT')
  assertNodeEditable(ctx.graph, set.id)
  const ids = new Set(properties.map((definition) => definition.id))
  for (const variant of variants) {
    if (variant.componentPropertyDefinitions.some((definition) => ids.has(definition.id)))
      assertNodeEditable(ctx.graph, variant.id)
  }
  const snapshot = () =>
    [set, ...variants].map((node) => ({
      id: node.id,
      componentPropertyDefinitions: structuredClone(node.componentPropertyDefinitions),
      pluginData: structuredClone(node.pluginData)
    }))
  const before = snapshot()
  const definitions = new Map(
    set.componentPropertyDefinitions.map((definition) => [definition.id, definition])
  )
  for (const definition of properties) {
    if (!definitions.has(definition.id)) definitions.set(definition.id, definition)
  }
  ctx.graph.updateNode(set.id, {
    componentPropertyDefinitions: structuredClone([...definitions.values()])
  })
  for (const variant of variants) {
    const local = variant.componentPropertyDefinitions.filter((definition) =>
      ids.has(definition.id)
    )
    if (!local.length) continue
    const defaults = {
      ...readPluginData(variant.pluginData, OPEN_PENCIL_PLUGIN_DATA.componentVariantDefaults)
    }
    for (const definition of local) {
      if (definition.defaultValue !== definitions.get(definition.id)?.defaultValue)
        defaults[definition.id] = definition.defaultValue
    }
    ctx.graph.updateNode(variant.id, {
      componentPropertyDefinitions: variant.componentPropertyDefinitions.filter(
        (definition) => !ids.has(definition.id)
      ),
      pluginData: withPluginData(
        variant.pluginData,
        OPEN_PENCIL_PLUGIN_DATA.componentVariantDefaults,
        Object.keys(defaults).length ? defaults : undefined
      )
    })
  }
  const after = snapshot()
  const apply = (values: typeof before) => {
    for (const { id, ...changes } of values) ctx.graph.updateNode(id, structuredClone(changes))
    ctx.requestRender()
  }
  ctx.undo.push({
    label: 'Share variant properties',
    forward: () => apply(after),
    inverse: () => apply(before)
  })
}
