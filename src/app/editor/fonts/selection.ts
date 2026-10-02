import {
  fontFaceDemand,
  fontManager,
  fontRemoteCoverageDemand,
  fontResolver
} from '@open-pencil/core/text'
import type { UseTypographyOptions } from '@open-pencil/vue'

import { listFonts, localFontStyles } from '@/app/editor/fonts'

export const typographyFontLoader: NonNullable<UseTypographyOptions['fontLoader']> = {
  styles(family) {
    const local = localFontStyles(family)
    return local.length > 0 ? local : fontManager.familyStyles(family)
  },
  async loadStyles(family) {
    const installed = await listFonts()
    if (installed.some((font) => font.family === family)) return
    await fontManager.loadFamilyStyles()
  },
  async load(family, style, characters = '') {
    const demand = fontManager.remoteStyleNeedsCoverage(family, style, Array.from(characters))
      ? fontRemoteCoverageDemand(family, style, Array.from(characters))
      : fontFaceDemand(family, style, characters)
    const state = fontResolver.state(demand).state
    if (state === 'failed' || state === 'exhausted') fontResolver.reset(demand)
    await fontResolver.demand(demand)
  }
}
