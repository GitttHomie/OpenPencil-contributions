import * as v from 'valibot'
import { computed, ref, watch, type Ref } from 'vue'

import { parseIntegration } from '@/app/ai/acp/configuration/schema'
import type { AIModelProfileDraft } from '@/app/ai/models/types'
import { useSettingsValidation } from '@/app/settings/validation/use'

import { useProfileLaunchSettings } from './launch'

export function useProfileIntegration(
  draft: AIModelProfileDraft,
  invalidMessage: Readonly<Ref<string>>
) {
  const { agent, configuration } = useProfileLaunchSettings(draft)
  const text = ref('')
  function resetText() {
    text.value = JSON.stringify(configuration.value, null, 2)
  }
  watch(() => [draft.providerID, draft.acpIntegration], resetText, { immediate: true })
  const values = computed(() => ({ configuration: text.value }))
  const schema = computed(() =>
    v.object({
      configuration: v.pipe(
        v.string(),
        v.check((value) => {
          try {
            return parseIntegration(value).agent === agent.value?.id
          } catch {
            return false
          }
        }, invalidMessage.value)
      )
    })
  )
  const validation = useSettingsValidation(values, schema)

  async function apply() {
    if (!(await validation.validate())) return false
    const next = parseIntegration(text.value)
    if (next.agent !== agent.value?.id) return false
    draft.acpIntegration = next
    // Applying a different mapping must never reinterpret the old field values.
    draft.acpLaunch = undefined
    draft.acpOptions = undefined
    validation.reset()
    return true
  }
  function restore() {
    draft.acpIntegration = undefined
    draft.acpLaunch = undefined
    draft.acpOptions = undefined
    resetText()
    validation.reset()
  }
  return { text, errors: validation.errors, apply, restore }
}
