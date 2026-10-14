<script setup lang="ts">
import { computed, useTemplateRef } from 'vue'

import {
  useAutomationMessages,
  useCommonMessages,
  useCredentialMessages,
  useSettingsMessages
} from '@open-pencil/vue'

import type { MCPConnectionDraft } from '@/app/integrations/mcp'
import type { MCPConnectionFieldErrors } from '@/app/integrations/mcp/settings/form'
import type { CredentialStatus } from '@/app/settings/credentials/types'
import type { SettingsSaveResult } from '@/app/settings/save-result'
import { focusInvalidField } from '@/components/settings/layout/focus'
import SettingsGroup from '@/components/settings/layout/SettingsGroup.vue'
import SettingsPage from '@/components/settings/layout/SettingsPage.vue'
import SettingsRow from '@/components/settings/layout/SettingsRow.vue'
import SettingsSaveFeedback from '@/components/settings/layout/SettingsSaveFeedback.vue'
import SettingsSection from '@/components/settings/layout/SettingsSection.vue'
import ProviderSettingsField from '@/components/settings/provider/ProviderSettingsField.vue'
import ProviderSettingsKeyField from '@/components/settings/provider/ProviderSettingsKeyField.vue'
import AppButton from '@/components/ui/button/AppButton.vue'
import AppInput from '@/components/ui/input/AppInput.vue'
import AppTextarea from '@/components/ui/input/AppTextarea.vue'
import AppSelect from '@/components/ui/select/AppSelect.vue'
import AppSwitch from '@/components/ui/toggle/AppSwitch.vue'

const draft = defineModel<MCPConnectionDraft>('draft', { required: true })
const token = defineModel<string>('token', { required: true })
const environment = defineModel<string>('environment', { default: '' })
const {
  tokenStatus,
  busy,
  error,
  saveResult,
  fieldErrors = {}
} = defineProps<{
  tokenStatus: CredentialStatus
  busy: boolean
  error: string
  saveResult?: SettingsSaveResult | null
  fieldErrors?: MCPConnectionFieldErrors
  testedTools?: string[] | null
  testing?: boolean
}>()
defineEmits<{
  cancel: []
  save: []
  remove: []
  clear: []
  blurField: [field: 'name' | 'url' | 'command' | 'credential']
  test: []
}>()
const automation = useAutomationMessages()
const common = useCommonMessages()
const credentials = useCredentialMessages()
const settings = useSettingsMessages()
const formElement = useTemplateRef<HTMLFormElement>('formElement')
defineExpose({ focusInvalid: () => focusInvalidField(formElement.value) })
const argumentsText = computed({
  get: () => (draft.value.args ?? []).join('\n'),
  set: (value: string) => {
    draft.value.args = value ? value.split('\n') : []
  }
})
const approvalsText = computed({
  get: () => (draft.value.autoApprove ?? []).join('\n'),
  set: (value: string) => {
    draft.value.autoApprove = value
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean)
  }
})
</script>

<template>
  <form
    ref="formElement"
    class="flex min-h-0 min-w-0 flex-1 flex-col"
    :aria-busy="busy"
    novalidate
    @submit.prevent="$emit('save')"
  >
    <SettingsPage>
      <SettingsSection>
        <template #title>{{
          draft.id ? automation.editConnection : automation.addServerConnection
        }}</template>
        <template #description>{{ automation.connectionEditorDescription }}</template>
        <fieldset :disabled="busy" class="flex min-w-0 flex-col gap-3">
          <ProviderSettingsField
            v-slot="{ control }"
            :label="automation.connectionName"
            :hint="automation.connectionNameHint"
            :error="fieldErrors.name"
            @blur="$emit('blurField', 'name')"
          >
            <AppInput
              v-bind="control"
              v-model="draft.name"
              tone="panel"
              :aria-label="automation.connectionName"
              autocomplete="off"
            />
          </ProviderSettingsField>
          <ProviderSettingsField v-slot="{ control }" :label="automation.transportType">
            <AppSelect
              v-bind="control"
              :model-value="draft.transportType ?? 'streamable-http'"
              :options="[
                { value: 'streamable-http', label: automation.httpServer },
                { value: 'stdio', label: automation.localCommand }
              ]"
              @update:model-value="draft.transportType = $event"
            />
          </ProviderSettingsField>
          <ProviderSettingsField
            v-if="draft.transportType !== 'stdio'"
            v-slot="{ control }"
            :label="automation.serverURL"
            :hint="automation.serverURLHint"
            :error="fieldErrors.url"
            @blur="$emit('blurField', 'url')"
          >
            <AppInput
              v-bind="control"
              v-model="draft.url"
              type="url"
              tone="panel"
              :aria-label="automation.serverURL"
              placeholder="https://example.com/mcp"
              autocomplete="off"
              autocapitalize="off"
              :spellcheck="false"
            />
          </ProviderSettingsField>
          <template v-else>
            <ProviderSettingsField
              v-slot="{ control }"
              :label="automation.command"
              :error="fieldErrors.command"
              @blur="$emit('blurField', 'command')"
            >
              <AppInput
                v-bind="control"
                :model-value="draft.command ?? ''"
                tone="panel"
                autocomplete="off"
                @update:model-value="draft.command = String($event)"
              />
            </ProviderSettingsField>
            <ProviderSettingsField v-slot="{ control }" :label="automation.arguments">
              <AppTextarea
                tone="panel"
                v-bind="control"
                v-model="argumentsText"
                :rows="3"
                spellcheck="false"
              />
            </ProviderSettingsField>
            <ProviderSettingsField
              v-slot="{ control }"
              :label="automation.environment"
              :hint="automation.environmentHint"
            >
              <AppTextarea
                tone="panel"
                v-bind="control"
                v-model="environment"
                :rows="4"
                spellcheck="false"
              />
            </ProviderSettingsField>
          </template>
          <ProviderSettingsField v-slot="{ control }" :label="automation.approvalList">
            <AppTextarea
              tone="panel"
              v-bind="control"
              v-model="approvalsText"
              :rows="2"
              spellcheck="false"
            />
          </ProviderSettingsField>
          <SettingsGroup>
            <SettingsRow :label="automation.enableConnection">
              <AppSwitch
                v-model="draft.enabled"
                :label="automation.enableConnection"
                :disabled="busy"
              />
            </SettingsRow>
            <SettingsRow
              v-if="draft.transportType !== 'stdio'"
              :label="automation.bearerAuthentication"
            >
              <AppSwitch
                :model-value="draft.authenticationType === 'bearer'"
                :label="automation.bearerAuthentication"
                :disabled="busy"
                @update:model-value="draft.authenticationType = $event ? 'bearer' : 'none'"
              />
            </SettingsRow>
          </SettingsGroup>
          <ProviderSettingsKeyField
            v-if="draft.authenticationType === 'bearer'"
            v-model="token"
            :label="automation.bearerToken"
            input-id="mcp-bearer-token"
            :saved="tokenStatus === 'configured'"
            kind="api"
            :placeholder="
              tokenStatus === 'configured'
                ? credentials.savedReplace
                : automation.bearerTokenPlaceholder
            "
            :hint="
              tokenStatus === 'configured'
                ? settings.savedCredentialHint
                : automation.bearerTokenRequired
            "
            :error="fieldErrors.credential"
            @clear="$emit('clear')"
            @blur="$emit('blurField', 'credential')"
          />
        </fieldset>
        <AppButton class="self-start" :disabled="busy" :loading="testing" @click="$emit('test')">{{
          automation.testConnection
        }}</AppButton>
        <div v-if="testedTools" role="status" class="flex flex-col gap-2 text-xs">
          <span>{{ automation.connectionReady }} ({{ testedTools.length }})</span>
          <ul class="max-h-40 overflow-auto text-muted">
            <li v-for="name in testedTools" :key="name">{{ name }}</li>
          </ul>
        </div>
        <SettingsSaveFeedback :error="error" :result="saveResult" />
      </SettingsSection>
      <template #footer>
        <AppButton
          v-if="draft.id"
          class="mr-auto"
          color="error"
          variant="link"
          :disabled="busy"
          @click="$emit('remove')"
          >{{ automation.deleteConnection }}</AppButton
        >
        <AppButton :disabled="busy" @click="$emit('cancel')">{{ common.cancel }}</AppButton>
        <AppButton type="submit" color="primary" variant="solid" :loading="busy">{{
          common.save
        }}</AppButton>
      </template>
    </SettingsPage>
  </form>
</template>
