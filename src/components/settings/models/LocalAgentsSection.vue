<script setup lang="ts">
import { computed } from 'vue'

import type { AIProviderID } from '@open-pencil/core/constants'
import { useI18n } from '@open-pencil/vue'

import { useLocalAgents } from '@/app/ai/agents/use'
import SettingsGroup from '@/components/settings/layout/SettingsGroup.vue'
import SettingsLink from '@/components/settings/layout/SettingsLink.vue'
import SettingsSection from '@/components/settings/layout/SettingsSection.vue'
import AppButton from '@/components/ui/button/AppButton.vue'
import AppAlert from '@/components/ui/feedback/AppAlert.vue'

const { ai, common } = useI18n()
const { providerId } = defineProps<{ providerId: AIProviderID }>()
const {
  agents,
  desktop,
  scanning,
  installing,
  error,
  npmAvailable,
  canvasBridgeAvailable,
  setupCanvasBridge,
  busy,
  refresh,
  install
} = useLocalAgents()
const selectedAgents = computed(() =>
  agents.value.filter((agent) => `acp:${agent.definition.id}` === providerId)
)
</script>

<template>
  <SettingsSection>
    <template #title>{{ ai.localAgentsTitle }}</template>
    <template #description>{{
      desktop ? ai.localAgentsDescription : ai.localAgentsDesktopOnly
    }}</template>
    <template v-if="desktop" #actions>
      <AppButton size="xs" :loading="scanning" :disabled="busy" @click="refresh(true)">
        <template #leading><icon-lucide-refresh-cw class="size-3" /></template>
        {{ common.refresh }}
      </AppButton>
    </template>

    <template v-if="desktop">
      <AppAlert
        v-if="error"
        tone="error"
        :heading="
          error === 'lookup'
            ? ai.localAgentsLookupFailed
            : error === 'npm'
              ? ai.localAgentsNpmRequired
              : error === 'canvas-install'
                ? ai.localAgentsCanvasInstallFailed
                : error === 'canvas-start'
                  ? ai.localAgentsCanvasStartFailed
                  : ai.localAgentsInstallFailed
        "
      />
      <AppAlert
        v-if="agents.length && (!canvasBridgeAvailable || error === 'canvas-start')"
        :heading="ai.localAgentsCanvasRequired"
        :description="ai.localAgentsCanvasHint"
      >
        <template #actions>
          <AppButton
            size="xs"
            variant="outline"
            :disabled="busy || (!canvasBridgeAvailable && !npmAvailable)"
            :loading="installing === 'canvas'"
            @click="setupCanvasBridge"
            >{{ canvasBridgeAvailable ? common.retry : ai.localAgentsCanvasInstall }}</AppButton
          >
          <p v-if="!canvasBridgeAvailable && !npmAvailable" class="text-[11px] text-muted">
            {{ ai.localAgentsNpmRequired }}
          </p>
        </template>
      </AppAlert>
      <SettingsGroup v-if="agents.length">
        <div
          v-for="agent in selectedAgents"
          :key="agent.definition.id"
          role="group"
          :aria-label="agent.definition.name"
          :data-agent-id="agent.definition.id"
          class="flex flex-wrap items-center justify-between gap-3 p-3"
        >
          <div class="min-w-0 flex-1">
            <p class="text-xs font-medium text-surface">{{ agent.definition.name }}</p>
            <p class="mt-1 text-[11px] text-muted">
              {{
                agent.status === 'available'
                  ? ai.localAgentAvailable
                  : agent.status === 'needs-adapter'
                    ? ai.localAgentNeedsAdapter
                    : ai.localAgentNotInstalled
              }}
            </p>
            <p v-if="agent.status === 'needs-adapter'" class="mt-1 text-[11px] text-muted">
              {{ npmAvailable ? ai.localAgentInstallHint : ai.localAgentsNpmRequired }}
            </p>
          </div>
          <AppButton
            v-if="agent.status === 'needs-adapter'"
            size="xs"
            :disabled="busy || !npmAvailable"
            :loading="installing === agent.definition.id"
            @click="install(agent.definition.id)"
          >
            {{ ai.localAgentInstall }}
          </AppButton>
          <SettingsLink
            v-if="agent.status !== 'available' && agent.definition.setupURL"
            :href="agent.definition.setupURL"
          >
            {{ ai.localAgentSetupGuide }}
          </SettingsLink>
        </div>
      </SettingsGroup>
    </template>
  </SettingsSection>
</template>
