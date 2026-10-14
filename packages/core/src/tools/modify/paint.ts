import { isValid, toUint8Array } from 'js-base64'
import * as v from 'valibot'

import type { Fill } from '@open-pencil/scene-graph'
import { parseColor } from '@open-pencil/scene-graph/color'
import { copyFills } from '@open-pencil/scene-graph/copy'
import { linearGradientTransform } from '@open-pencil/scene-graph/gradient'
import type { Vector } from '@open-pencil/scene-graph/primitives'

import { BLACK } from '#core/constants'
import { withBatch } from '#core/tools/batch/define'
import { toolNumber, nodeIdInput } from '#core/tools/input'
import { defineTool } from '#core/tools/schema'

import { withImageFill } from './fill-stack'

export const setFill = withBatch(
  defineTool({
    name: 'set_fill',

    description:
      'Set a solid or linear gradient fill. By default replaces all fills. ' +
      'Use operation="append" to add a scrim above an existing image without removing it, ' +
      'or fill_index to replace just one fill (zero-based, bottom to top). ' +
      'Colors accept alpha, e.g. color="#00000000", color_end="#000000CC", gradient="top-bottom" for a transparent-to-dark scrim. ' +
      'Returns the resulting fill stack so you can verify the image and scrim are both present.',
    execution: { kind: 'sync', mutation: 'properties' },
    input: v.strictObject({
      id: nodeIdInput,
      operation: v.optional(v.picklist(['replace', 'append']), 'replace'),
      fill_index: v.optional(
        toolNumber(
          v.pipe(
            v.number(),
            v.integer(),
            v.minValue(0),
            v.description(
              'Existing fill index to replace; omit to replace all. Cannot be combined with append.'
            )
          )
        )
      ),
      opacity: v.optional(
        toolNumber(
          v.pipe(
            v.number(),
            v.minValue(0),
            v.maxValue(1),
            v.description('Opacity of this fill, not the node.')
          )
        ),
        1
      ),
      color: v.pipe(v.string(), v.description('Color (hex). For gradient: start color.')),
      color_end: v.optional(
        v.pipe(v.string(), v.description('End color for gradient (if omitted, solid fill)'))
      ),
      gradient: v.optional(
        v.pipe(
          v.picklist([
            'top-bottom',
            'bottom-top',
            'left-right',
            'right-left',
            'top-left-bottom-right',
            'bottom-right-top-left',
            'top-right-bottom-left',
            'bottom-left-top-right'
          ]),
          v.description('Gradient direction')
        )
      )
    }),
    execute: (figma, { id, color, color_end, gradient, operation, fill_index, opacity }) => {
      const node = figma.getNodeById(id)
      if (!node) return { error: `Node "${id}" not found` }
      if (typeof node.fills === 'symbol')
        return {
          error:
            'This text has mixed character fills. Select a uniform paint range before editing its fill stack.'
        }
      if (operation === 'append' && fill_index !== undefined)
        return { error: 'Use append without fill_index, or replace with fill_index.' }
      if (fill_index !== undefined && fill_index >= node.fills.length)
        return { error: `fill_index ${fill_index} is outside the existing fill stack.` }
      if ((gradient !== undefined) !== (color_end !== undefined))
        return { error: 'A gradient requires both gradient direction and color_end.' }

      const c = parseColor(color)
      let fill: Fill = { type: 'SOLID', color: c, opacity: opacity * c.a, visible: true }
      if (gradient && color_end) {
        const cEnd = parseColor(color_end)
        const ends: Record<typeof gradient, [Vector, Vector]> = {
          'top-bottom': [
            { x: 0.5, y: 0 },
            { x: 0.5, y: 1 }
          ],
          'bottom-top': [
            { x: 0.5, y: 1 },
            { x: 0.5, y: 0 }
          ],
          'left-right': [
            { x: 0, y: 0.5 },
            { x: 1, y: 0.5 }
          ],
          'right-left': [
            { x: 1, y: 0.5 },
            { x: 0, y: 0.5 }
          ],
          'top-left-bottom-right': [
            { x: 0, y: 0 },
            { x: 1, y: 1 }
          ],
          'bottom-right-top-left': [
            { x: 1, y: 1 },
            { x: 0, y: 0 }
          ],
          'top-right-bottom-left': [
            { x: 1, y: 0 },
            { x: 0, y: 1 }
          ],
          'bottom-left-top-right': [
            { x: 0, y: 1 },
            { x: 1, y: 0 }
          ]
        }
        const [start, end] = ends[gradient]
        fill = {
          type: 'GRADIENT_LINEAR',
          color: c,
          opacity,
          visible: true,
          gradientStops: [
            { position: 0, color: c },
            { position: 1, color: cEnd }
          ],
          gradientTransform: linearGradientTransform(start, end)
        }
      }

      const fills = copyFills([...node.fills])
      if (operation === 'append') fills.push(fill)
      else if (fill_index !== undefined) fills[fill_index] = fill
      else fills.splice(0, fills.length, fill)
      node.fills = fills
      return {
        id,
        color: c,
        gradient,
        start: gradient ? c : undefined,
        end: fill.gradientStops?.at(1)?.color,
        fill_index: operation === 'append' ? fills.length - 1 : (fill_index ?? 0),
        fills: copyFills(fills)
      }
    }
  }),
  { target: 'id' }
)

export const setStroke = withBatch(
  defineTool({
    name: 'set_stroke',

    description: 'Set the stroke (border) of a node.',
    execution: { kind: 'sync', mutation: 'properties' },
    input: v.strictObject({
      id: nodeIdInput,
      color: v.pipe(v.string(), v.description('Stroke color (hex)')),
      weight: v.optional(
        toolNumber(v.pipe(v.number(), v.minValue(0.1), v.description('Stroke weight'))),
        1
      ),
      align: v.optional(
        v.pipe(v.picklist(['INSIDE', 'CENTER', 'OUTSIDE']), v.description('Stroke alignment')),
        'INSIDE'
      )
    }),
    execute: (figma, { id, color, weight, align }) => {
      const node = figma.getNodeById(id)
      if (!node) return { error: `Node "${id}" not found` }

      const c = parseColor(color)
      node.strokes = [
        {
          type: 'SOLID',
          color: c,
          weight: weight,
          opacity: 1,
          visible: true,
          align
        }
      ]
      return { id, color: c, weight: weight }
    }
  }),
  { target: 'id' }
)

export const setImageFill = defineTool({
  name: 'set_image_fill',

  description:
    'Set an image fill from original Base64 image data. For renders or other files on disk, prefer ' +
    'import_image with their path: never copy Base64 from model vision previews or substitute a ' +
    'screenshot/thumbnail for the original. Replaces the existing image or base solid placeholder ' +
    'while preserving other fills (including gradient scrims) and children. Fills paint bottom to top.',
  execution: { kind: 'sync', mutation: 'document' },
  input: v.strictObject({
    id: nodeIdInput,
    image_data: v.pipe(
      v.string(),
      v.description('Base64-encoded image bytes (PNG, JPEG, or WEBP)')
    ),
    scale_mode: v.optional(
      v.pipe(v.picklist(['FILL', 'FIT', 'CROP', 'TILE']), v.description('Image scale mode')),
      'FILL'
    )
  }),
  execute: (figma, { id, image_data, scale_mode }) => {
    const node = figma.getNodeById(id)
    if (!node) return { error: `Node "${id}" not found` }
    if (typeof node.fills === 'symbol')
      return { error: 'This text has mixed character fills; choose a frame for the image.' }
    if (!isValid(image_data)) return { error: 'image_data is not valid Base64' }
    const bytes = toUint8Array(image_data)
    const decoded = figma.rasterCodec?.decode(bytes)
    if (figma.rasterCodec && !decoded) return { error: 'The image data could not be decoded.' }
    const image = figma.createImage(bytes)
    const mode = scale_mode
    node.fills = withImageFill(node.fills, {
      type: 'IMAGE',
      color: BLACK,
      opacity: 1,
      visible: true,
      imageHash: image.hash,
      imageScaleMode: mode
    })
    return {
      id,
      imageHash: image.hash,
      scaleMode: mode,
      fills: copyFills([...node.fills]),
      width: decoded?.width,
      height: decoded?.height
    }
  }
})
