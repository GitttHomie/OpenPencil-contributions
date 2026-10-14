<script setup lang="ts">
import { ref } from 'vue'

import { useI18n } from '@open-pencil/vue'

import { designCheckSettings } from '@/app/ai/design-checks/preferences'
import { useDesignCheckOptions } from '@/app/ai/design-checks/settings'
import SettingsGroup from '@/components/settings/layout/SettingsGroup.vue'
import SettingsRow from '@/components/settings/layout/SettingsRow.vue'
import SettingsSection from '@/components/settings/layout/SettingsSection.vue'
import AppCollapsible from '@/components/ui/collapsible/AppCollapsible.vue'
import AppSelect from '@/components/ui/select/AppSelect.vue'
import AppSwitch from '@/components/ui/toggle/AppSwitch.vue'

const { ai } = useI18n()
const { reviewerOptions } = useDesignCheckOptions(ai)
const expanded = ref(false)
</script>

<template>
  <SettingsSection>
    <template #title>{{ ai.designChecks }}</template>
    <template #description>{{ ai.designChecksDescription }}</template>
    <SettingsGroup>
      <SettingsRow :label="ai.designChecksAutomatic">
        <AppSwitch v-model="designCheckSettings.automatic" :label="ai.designChecksAutomatic" />
      </SettingsRow>
      <SettingsRow :label="ai.designChecksReviewer" :description="ai.designChecksReviewerHint">
        <AppSelect
          v-model="designCheckSettings.reviewer"
          :options="reviewerOptions"
          :label="ai.designChecksReviewer"
          class="w-52"
        />
      </SettingsRow>
      <SettingsRow :label="ai.designChecksCorrections">
        <AppSwitch
          v-model="designCheckSettings.corrections"
          :label="ai.designChecksCorrections"
          :disabled="!designCheckSettings.automatic"
        />
      </SettingsRow>
    </SettingsGroup>
    <AppCollapsible v-model:open="expanded">
      <template #label>{{ ai.advancedModelSettings }}</template>
      <SettingsRow :label="ai.designChecksPasses">
        <AppSelect
          v-model="designCheckSettings.maxCorrectionPasses"
          :label="ai.designChecksPasses"
          :options="[
            { value: 0, label: '0' },
            { value: 1, label: '1' },
            { value: 2, label: '2' }
          ]"
        />
      </SettingsRow>
    </AppCollapsible>
  </SettingsSection>
</template>
