import * as v from 'valibot'

import type { Fill, Stroke, SceneGraph } from '@open-pencil/scene-graph'
import { parseColor } from '@open-pencil/scene-graph/color'
import { copyFills, copyStrokes } from '@open-pencil/scene-graph/copy'

import { BLACK } from '#core/constants'
import { nodeIdInput, toolNumber } from '#core/tools/input'
import { defineTool } from '#core/tools/schema'

const number = toolNumber()
const fraction = toolNumber(v.pipe(v.number(), v.minValue(0), v.maxValue(1)))
const nonnegative = toolNumber(v.pipe(v.number(), v.minValue(0)))
const transform = v.object({
  m00: number,
  m01: number,
  m02: number,
  m10: number,
  m11: number,
  m12: number
})
const paintInput = v.object({
  type: v.picklist([
    'SOLID',
    'IMAGE',
    'GRADIENT_LINEAR',
    'GRADIENT_RADIAL',
    'GRADIENT_ANGULAR',
    'GRADIENT_DIAMOND'
  ]),
  color: v.optional(v.string()),
  opacity: v.optional(fraction, 1),
  visible: v.optional(v.boolean(), true),
  stops: v.optional(
    v.pipe(v.array(v.object({ color: v.string(), position: fraction })), v.minLength(2))
  ),
  transform: v.optional(
    v.pipe(
      transform,
      v.description(
        'Normalized paint transform; controls gradient position, rotation and scale, or image crop. Inspect an existing paint to reuse its transform.'
      )
    )
  ),
  image_hash: v.optional(v.string()),
  image_scale_mode: v.optional(v.picklist(['FILL', 'FIT', 'CROP', 'TILE']), 'FILL'),
  weight: v.optional(nonnegative),
  align: v.optional(v.picklist(['INSIDE', 'CENTER', 'OUTSIDE'])),
  cap: v.optional(v.picklist(['NONE', 'ROUND', 'SQUARE', 'ARROW_LINES', 'ARROW_EQUILATERAL'])),
  join: v.optional(v.picklist(['MITER', 'BEVEL', 'ROUND'])),
  dash_pattern: v.optional(v.array(nonnegative))
})

type PaintInput = v.InferOutput<typeof paintInput>

function createPaint(graph: SceneGraph, paint: PaintInput): Fill {
  if (paint.type === 'SOLID' && !paint.color) throw new Error('Solid paint requires color')
  if (paint.type.startsWith('GRADIENT_') && !paint.stops)
    throw new Error('Gradient paint requires at least two stops')
  if (paint.type === 'IMAGE' && (!paint.image_hash || !graph.images.has(paint.image_hash)))
    throw new Error('Image paint requires an image_hash already present in the document')
  const color = paint.color ? parseColor(paint.color) : BLACK
  const fill: Fill = {
    type: paint.type,
    color,
    opacity: paint.opacity * (paint.type === 'SOLID' ? color.a : 1),
    visible: paint.visible
  }
  if (paint.type.startsWith('GRADIENT_')) {
    fill.gradientStops = paint.stops
      ?.map((stop) => ({ color: parseColor(stop.color), position: stop.position }))
      .toSorted((left, right) => left.position - right.position)
    fill.gradientTransform = paint.transform ?? { m00: 1, m01: 0, m02: 0, m10: 0, m11: 1, m12: 0 }
  }
  if (paint.type === 'IMAGE') {
    fill.imageHash = paint.image_hash
    fill.imageScaleMode = paint.image_scale_mode
    if (paint.transform) fill.imageTransform = paint.transform
  }
  return fill
}

function createStrokePaint(graph: SceneGraph, paint: PaintInput, previous?: Stroke): Stroke {
  return {
    ...createPaint(graph, paint),
    weight: paint.weight ?? previous?.weight ?? 1,
    align: paint.align ?? previous?.align ?? 'INSIDE',
    cap: paint.cap ?? previous?.cap,
    join: paint.join ?? previous?.join,
    dashPattern: paint.dash_pattern ?? previous?.dashPattern
  }
}

/** Indexed color bindings follow their paint when an earlier entry is removed. */
function paintBindingChanges(
  graph: SceneGraph,
  id: string,
  target: 'fills' | 'strokes',
  index: number,
  operation: 'append' | 'replace' | 'remove'
) {
  if (operation === 'append') return []
  return Object.entries(graph.getNode(id)?.boundVariables ?? {}).flatMap(([field, variableId]) => {
    const match = /^(fills|strokes)\/(\d+)\/color$/.exec(field)
    if (!match || match[1] !== target) return []
    const paintIndex = Number(match[2])
    if (paintIndex < index || (operation === 'replace' && paintIndex !== index)) return []
    const nextField = paintIndex === index ? null : `${target}/${paintIndex - 1}/color`
    if (nextField && graph.variables.get(variableId)?.type !== 'COLOR')
      throw new Error(`Cannot move invalid paint variable binding "${field}"`)
    return [{ field, nextField, variableId }]
  })
}

function paintIndexForOperation(
  length: number,
  operation: 'append' | 'replace' | 'remove',
  index: number | undefined,
  paint: PaintInput | undefined
): number {
  if (operation === 'append' && index !== undefined)
    throw new Error('append does not accept an index')
  if (operation !== 'append' && (index === undefined || index >= length))
    throw new Error('replace/remove requires an existing paint index')
  if (operation === 'remove' && paint) throw new Error('remove does not accept a paint')
  if (operation !== 'remove' && !paint) throw new Error('append/replace requires a paint')
  return operation === 'append' ? length : (index ?? 0)
}

export const setPaint = defineTool({
  name: 'set_paint',
  description:
    'Edit one fill or stroke without replacing the rest: append, replace at an index, or remove. Supports solid/image paints and linear/radial/angular/diamond gradients with multiple stops and editable transforms. Stacks run bottom to top. Existing stroke width/alignment/caps/dashes survive paint replacement unless specified. Replacement detaches that paint’s color variable; removal shifts remaining color bindings with their paints. Returns both resulting stacks.',
  execution: { kind: 'sync', mutation: 'properties' },
  input: v.object({
    id: nodeIdInput,
    target: v.picklist(['fills', 'strokes']),
    operation: v.picklist(['append', 'replace', 'remove']),
    index: v.optional(toolNumber(v.pipe(v.number(), v.integer(), v.minValue(0)))),
    paint: v.optional(paintInput)
  }),
  execute(figma, { id, target, operation, index, paint }) {
    const node = figma.getNodeById(id)
    if (!node) throw new Error(`Node "${id}" not found`)
    const stack = target === 'fills' ? node.fills : node.strokes
    const paintIndex = paintIndexForOperation(stack.length, operation, index, paint)
    const bindings = paintBindingChanges(figma.graph, id, target, paintIndex, operation)
    if (target === 'fills') {
      const fills = copyFills([...node.fills])
      if (paint)
        fills.splice(paintIndex, operation === 'append' ? 0 : 1, createPaint(figma.graph, paint))
      else fills.splice(paintIndex, 1)
      node.fills = fills
    } else {
      const strokes = copyStrokes([...node.strokes])
      if (paint)
        strokes.splice(
          paintIndex,
          operation === 'append' ? 0 : 1,
          createStrokePaint(figma.graph, paint, index === undefined ? undefined : strokes[index])
        )
      else strokes.splice(paintIndex, 1)
      node.strokes = strokes
    }
    for (const binding of bindings) figma.graph.unbindVariable(id, binding.field)
    for (const binding of bindings) {
      if (binding.nextField) figma.graph.bindVariable(id, binding.nextField, binding.variableId)
    }
    return {
      id,
      target,
      index: paintIndex,
      fills: copyFills([...node.fills]),
      strokes: copyStrokes([...node.strokes])
    }
  }
})
