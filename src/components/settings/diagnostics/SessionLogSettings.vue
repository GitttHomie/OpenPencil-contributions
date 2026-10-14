<script setup lang="ts">
import { useDiagnosticsMessages } from '@open-pencil/vue'

import { sessionLoggingEnabled, sessionLoggingFailed } from '@/app/ai/chat/logging/service'
import { useSessionLogActions } from '@/app/ai/chat/logging/settings'
import SettingsRow from '@/components/settings/layout/SettingsRow.vue'
import SettingsSection from '@/components/settings/layout/SettingsSection.vue'
import AppButton from '@/components/ui/button/AppButton.vue'
import AppAlert from '@/components/ui/feedback/AppAlert.vue'
import AppSwitch from '@/components/ui/toggle/AppSwitch.vue'
import { IS_TAURI } from '@/constants'

const messages = useDiagnosticsMessages()
const { busy, failed, exportLogs, revealLogs, clearLogs } = useSessionLogActions()
</script>

<template>
  <SettingsSection>
    <template #title>{{ messages.sessionLogs }}</template>
    <template #description>{{ messages.sessionLogsDescription }}</template>
    <SettingsRow :label="messages.sessionLogging">
      <AppSwitch v-model="sessionLoggingEnabled" :label="messages.sessionLogging" />
    </SettingsRow>
    <div class="flex flex-wrap gap-2">
      <AppButton size="sm" :disabled="busy" @click="exportLogs">{{
        messages.exportSessionLogs
      }}</AppButton>
      <AppButton v-if="IS_TAURI" size="sm" :disabled="busy" @click="revealLogs">{{
        messages.openSessionLogs
      }}</AppButton>
      <AppButton size="sm" color="error" :disabled="busy" @click="clearLogs">{{
        messages.clearSessionLogs
      }}</AppButton>
    </div>
    <AppAlert
      v-if="failed || sessionLoggingFailed"
      tone="error"
      :heading="messages.sessionLogFailed"
    />
  </SettingsSection>
</template>
