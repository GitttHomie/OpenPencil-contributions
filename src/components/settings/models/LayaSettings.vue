<script setup lang="ts">
import { computed, onMounted } from 'vue'

import { useI18n } from '@open-pencil/vue'

import { automaticRouting } from '@/app/ai/routing/preferences'
import {
  layaStatus,
  layaProgress,
  layaFailure,
  prepareLaya,
  refreshLaya,
  unloadLaya
} from '@/app/ai/routing/runtime'
import { hasFastRoutingTarget } from '@/app/ai/routing/targets'
import SettingsGroup from '@/components/settings/layout/SettingsGroup.vue'
import SettingsRow from '@/components/settings/layout/SettingsRow.vue'
import SettingsSection from '@/components/settings/layout/SettingsSection.vue'
import AppButton from '@/components/ui/button/AppButton.vue'
import AppAlert from '@/components/ui/feedback/AppAlert.vue'
import AppSwitch from '@/components/ui/toggle/AppSwitch.vue'

const { ai, common } = useI18n()
const fastAvailable = computed(hasFastRoutingTarget)
const percentage = computed(() => {
  const progress = layaProgress.value
  return progress?.total && progress.completed !== undefined
    ? Math.min(100, Math.round((progress.completed / progress.total) * 100))
    : null
})
onMounted(() =>
  refreshLaya().catch(() => {
    layaFailure.value = 'setup-failed'
  })
)
async function unload() {
  automaticRouting.value = false
  await unloadLaya().catch(() => {
    layaFailure.value = 'setup-failed'
  })
}
</script>

<template>
  <SettingsSection>
    <template #title>{{ ai.layaTitle }}</template>
    <template #description>{{ ai.layaDescription }}</template>
    <div class="flex flex-wrap items-center gap-2">
      <AppButton v-if="!layaStatus.loaded && !layaStatus.busy" @click="prepareLaya">
        {{ layaStatus.installed ? common.enable : ai.layaSetup }}
      </AppButton>
      <AppButton v-if="layaStatus.loaded || layaStatus.busy" @click="unload">
        {{ layaStatus.busy ? common.cancel : ai.layaUnload }}
      </AppButton>
      <span v-if="layaStatus.busy" role="status" class="text-xs text-muted">
        {{ layaProgress?.stage === 'download' ? common.downloading : ai.layaPreparing }}
        <span v-if="percentage !== null">{{ percentage }}%</span>
      </span>
      <span v-else-if="layaStatus.loaded" role="status" class="text-xs text-muted">{{
        ai.layaReady
      }}</span>
    </div>
    <AppAlert v-if="layaFailure" :heading="ai.layaFailed" />
    <SettingsGroup>
      <SettingsRow :label="ai.layaAutomatic" :description="ai.layaAutomaticHint">
        <AppSwitch
          v-model="automaticRouting"
          :disabled="!layaStatus.loaded || layaStatus.busy || !fastAvailable"
          :label="ai.layaAutomatic"
        />
      </SettingsRow>
    </SettingsGroup>
    <p v-if="!fastAvailable" class="text-xs text-muted">
      {{ ai.modelRoleFast }} · {{ common.unavailable }}
    </p>
  </SettingsSection>
</template>
