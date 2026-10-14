import { computed, type Ref } from 'vue'

import { aiModelSettings, canAssignModelRole } from '@/app/ai/models'

export function useDesignCheckOptions(ai: Readonly<Ref<{ designChecksUseAgent: string }>>) {
  const reviewerOptions = computed(() => [
    { value: 'design', label: ai.value.designChecksUseAgent },
    ...aiModelSettings.value.models
      .filter((profile) => canAssignModelRole(profile, 'vision'))
      .map((profile) => ({ value: profile.id, label: profile.name }))
  ])
  return { reviewerOptions }
}
