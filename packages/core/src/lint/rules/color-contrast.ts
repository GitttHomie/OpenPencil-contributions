import { colorToHex, contrastRatio } from '@open-pencil/scene-graph/color'

import { textContrastColors } from '#core/lint/contrast'
import { defineRule } from '#core/lint/rule'

const MIN_CONTRAST = 4.5

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
    if (ratio < MIN_CONTRAST)
      context.report({
        node,
        message: `Contrast ratio ${(Math.floor(ratio * 100) / 100).toFixed(2)}:1 is below WCAG AA`,
        suggest: 'Increase contrast between text and background',
        data: {
          ratio: Math.floor(ratio * 100) / 100,
          minRatio: MIN_CONTRAST,
          foreground: colorToHex(colors.foreground),
          background: colorToHex(colors.background)
        }
      })
  }
})
