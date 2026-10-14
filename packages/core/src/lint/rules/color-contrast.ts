import { colorToHex, contrastRatio } from '@open-pencil/scene-graph/color'

import { textContrastColors } from '#core/lint/contrast'
import { defineRule } from '#core/lint/rule'

/** WCAG AA: 4.5:1 for text, 3:1 for large text, which is 24px, or 18.66px when bold. */
const MIN_CONTRAST = 4.5
const MIN_LARGE_CONTRAST = 3
const LARGE_TEXT_PX = 24
const LARGE_BOLD_TEXT_PX = 18.66
const BOLD_WEIGHT = 700

function minContrast(style: { fontSize: number; fontWeight: number }): number {
  const large =
    style.fontSize >= LARGE_TEXT_PX ||
    (style.fontSize >= LARGE_BOLD_TEXT_PX && style.fontWeight >= BOLD_WEIGHT)
  return large ? MIN_LARGE_CONTRAST : MIN_CONTRAST
}

/** The strictest threshold any stretch of the text needs. */
function requiredContrast(node: {
  fontSize: number
  textStyles?: { fontSize: number; fontWeight: number }[]
}): number {
  const styles = node.textStyles ?? [{ fontSize: node.fontSize, fontWeight: 0 }]
  return Math.max(...styles.map(minContrast))
}

export default defineRule({
  meta: {
    id: 'color-contrast',
    category: 'accessibility',
    severity: 'error',
    description: 'Text must have sufficient contrast against its background'
  },
  match: ['TEXT'],
  check(node, context) {
    const colors = textContrastColors(node, (parent) => context.getParent(parent))
    if (!colors) return
    const ratio = contrastRatio(colors.foreground, colors.background)
    const minRatio = requiredContrast(node)
    if (ratio < minRatio)
      context.report({
        node,
        message: `Contrast ratio ${(Math.floor(ratio * 100) / 100).toFixed(2)}:1 is below WCAG AA`,
        suggest: 'Increase contrast between text and background',
        data: {
          ratio: Math.floor(ratio * 100) / 100,
          minRatio,
          foreground: colorToHex(colors.foreground),
          background: colorToHex(colors.background)
        }
      })
  }
})
