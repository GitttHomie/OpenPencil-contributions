import { omit } from 'es-toolkit'
import { computed, type Ref } from 'vue'

import type { ACPSessionValues } from '@/app/ai/acp/configuration/session'
import type { ACPModelCatalog } from '@/app/ai/acp/models'
import type { AIModelProfileDraft } from '@/app/ai/models/types'

const DEFAULT = '__cli_default__'
export function useProfileSessionOptions(
  draft: AIModelProfileDraft,
  catalog: Readonly<Ref<ACPModelCatalog | null>>,
  labels: Readonly<Ref<{ default: string; unavailable: string }>>
) {
  const controls = computed(() => {
    const advertised = catalog.value?.controls ?? []
    const ids = new Set([
      ...advertised.map((control) => control.id),
      ...Object.keys(draft.acpOptions ?? {})
    ])
    return [...ids].map((id) => {
      const control = advertised.find((control) => control.id === id)
      const selected =
        draft.acpOptions && Object.hasOwn(draft.acpOptions, id) ? draft.acpOptions[id] : undefined
      const invalid =
        selected !== undefined &&
        Boolean(catalog.value) &&
        !control?.options.some((option) => option.value === selected)
      const options = (control?.options ?? []).map((option) => ({
        value: JSON.stringify([option.value]),
        label: option.name
      }))
      if (invalid)
        options.unshift({
          value: JSON.stringify([selected]),
          label: `${selected} (${labels.value.unavailable})`
        })
      return {
        id,
        name: control?.name ?? id,
        description: control?.description,
        invalid,
        selected: selected === undefined ? DEFAULT : JSON.stringify([selected]),
        options: [{ value: DEFAULT, label: labels.value.default }, ...options]
      }
    })
  })
  function update(id: string, encoded: string) {
    let next: ACPSessionValues = omit(draft.acpOptions ?? {}, [id])
    if (encoded !== DEFAULT) {
      const choice = catalog.value?.controls
        ?.find((control) => control.id === id)
        ?.options.find((option) => JSON.stringify([option.value]) === encoded)
      if (!choice) return
      next = { ...next, [id]: choice.value }
    }
    draft.acpOptions = Object.keys(next).length ? next : undefined
  }
  return { controls, update }
}
