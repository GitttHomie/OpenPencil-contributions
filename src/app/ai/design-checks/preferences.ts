import { useLocalStorage } from '@vueuse/core'
import * as v from 'valibot'

export const designCheckSettingsSchema = v.object({
  automatic: v.optional(v.boolean(), false),
  corrections: v.optional(v.boolean(), true),
  maxCorrectionPasses: v.optional(v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(2)), 2),
  reviewer: v.optional(v.string(), 'design')
})

export const designCheckSettings = useLocalStorage(
  'open-pencil:ai:design-checks',
  v.parse(designCheckSettingsSchema, {}),
  {
    serializer: {
      read(text) {
        const parsed = v.safeParse(
          v.pipe(v.string(), v.parseJson(), designCheckSettingsSchema),
          text
        )
        return parsed.success ? parsed.output : v.parse(designCheckSettingsSchema, {})
      },
      write: JSON.stringify
    }
  }
)
