<script setup lang="ts">
import { computed } from 'vue'

import { useAutomationMessages } from '@open-pencil/vue'

import { useMCPImport } from '@/app/integrations/mcp/settings/import'
import { useSettingsFormGuard } from '@/app/settings/navigation/use'
import ProviderSettingsField from '@/components/settings/provider/ProviderSettingsField.vue'
import AppButton from '@/components/ui/button/AppButton.vue'
import AppCollapsible from '@/components/ui/collapsible/AppCollapsible.vue'
import AppAlert from '@/components/ui/feedback/AppAlert.vue'
import AppTextarea from '@/components/ui/input/AppTextarea.vue'

const automation = useAutomationMessages()
const { text, busy, failed, names, apply } = useMCPImport()
const dirty = computed(() => text.value.length > 0)
useSettingsFormGuard(
  {
    dirty,
    busy,
    cancel: () => {
      text.value = ''
    }
  },
  computed(() => dirty.value || busy.value)
)
</script>

<template>
  <AppCollapsible :label="automation.importConfiguration">
    <div class="flex flex-col gap-3 pt-3">
      <ProviderSettingsField
        v-slot="{ control }"
        :label="automation.configurationJSON"
        :hint="automation.importHint"
      >
        <AppTextarea
          v-bind="control"
          v-model="text"
          :rows="8"
          :disabled="busy"
          spellcheck="false"
        />
      </ProviderSettingsField>
      <p v-if="names.length" class="text-xs text-muted">{{ names.join(', ') }}</p>
      <AppAlert v-if="failed" tone="error" :heading="automation.importFailed" />
      <AppButton class="self-start" :disabled="!names.length" :loading="busy" @click="apply">
        {{ automation.importConfiguration }}
      </AppButton>
    </div>
  </AppCollapsible>
</template>
