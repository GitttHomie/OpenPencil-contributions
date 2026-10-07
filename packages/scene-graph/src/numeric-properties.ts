import { omit } from 'es-toolkit'

import type { SceneNode } from './types'

export const CORNER_RADIUS_PATHS = [
  'topLeftRadius',
  'topRightRadius',
  'bottomRightRadius',
  'bottomLeftRadius'
] as const
export const BORDER_WIDTH_PATHS = [
  'borderTopWeight',
  'borderRightWeight',
  'borderBottomWeight',
  'borderLeftWeight'
] as const
export const NUMERIC_PROPERTY_GROUPS = [
  { paths: CORNER_RADIUS_PATHS, shared: 'cornerRadius', independent: 'independentCorners' },
  { paths: BORDER_WIDTH_PATHS, shared: 'strokeWeight', independent: 'independentStrokeWeights' }
] as const
export type NumericPropertyGroup = (typeof NUMERIC_PROPERTY_GROUPS)[number]

export function sharedNumberGroup(node: SceneNode, path: string): NumericPropertyGroup | undefined {
  return NUMERIC_PROPERTY_GROUPS.find(
    (group) => group.paths.some((side) => side === path) && !node[group.independent]
  )
}

export function numberPropertyValue(node: SceneNode, path: string): number | undefined {
  const effectivePath = sharedNumberGroup(node, path)?.shared ?? path
  const value =
    effectivePath === 'strokeWeight'
      ? node.strokes[0]?.weight
      : node[effectivePath as keyof SceneNode]
  return typeof value === 'number' ? value : undefined
}

/** Equivalent independent storage, including the shared binding's coordinate conversion. */
export function independentNumberGroup(
  node: SceneNode,
  group: NumericPropertyGroup
): Partial<SceneNode> {
  const id = node.boundVariables[group.shared]
  const scale = node.variableBindingScales[group.shared] ?? 1
  const value = numberPropertyValue(node, group.shared) ?? 0
  const paths = [group.shared, ...group.paths]
  const bindings = omit(node.boundVariables, paths)
  const scales = omit(node.variableBindingScales, paths)
  if (id) {
    for (const path of group.paths) {
      bindings[path] = id
      scales[path] = scale
    }
  }
  return {
    [group.independent]: true,
    ...Object.fromEntries(group.paths.map((path) => [path, value])),
    boundVariables: bindings,
    variableBindingScales: scales
  }
}

/** Project a shared definition into an instance's independently overridden representation. */
export function sourceForNumberGroups(
  source: SceneNode,
  target: SceneNode,
  protectedField: (field: string) => boolean
): SceneNode {
  for (const group of NUMERIC_PROPERTY_GROUPS) {
    if (
      target[group.independent] &&
      !source[group.independent] &&
      protectedField(group.independent)
    ) {
      source = { ...source, ...independentNumberGroup(source, group) }
    }
  }
  return source
}
