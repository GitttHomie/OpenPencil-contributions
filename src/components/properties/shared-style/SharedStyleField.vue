<script setup lang="ts">
import { ref, useId, watch } from 'vue'

import type { SharedStyleKind } from '@open-pencil/scene-graph'
import { useI18n } from '@open-pencil/vue'

import { useSharedStylePicker } from '@/components/properties/shared-style/useSharedStylePicker'
import AppButton from '@/components/ui/button/AppButton.vue'
import IconButton from '@/components/ui/button/IconButton.vue'
import AppAlert from '@/components/ui/feedback/AppAlert.vue'
import AppInput from '@/components/ui/input/AppInput.vue'
import PanelFieldGroup from '@/components/ui/panel/PanelFieldGroup.vue'
import PanelGrid from '@/components/ui/panel/PanelGrid.vue'
import AppPickerField from '@/components/ui/select/AppPickerField.vue'

const { kind, label } = defineProps<{ kind: SharedStyleKind; label: string }>()
const { visible, value, options, update, authoring } = useSharedStylePicker(kind)
const { panels, common } = useI18n()
const creating = ref(false)
const name = ref('')
const error = ref('')
const saving = ref(false)
const inputId = useId()
function startCreating() {
  creating.value = true
  error.value = ''
}
watch([value, authoring.authoringTargetId], () => {
  creating.value = false
  name.value = ''
  error.value = ''
})

function create(close: () => void) {
  try {
    authoring.create(name.value)
    creating.value = false
    name.value = ''
    error.value = ''
    close()
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : panels.value.textStyleSaveFailed
  }
}
async function updateDefinition(close: () => void) {
  saving.value = true
  error.value = ''
  try {
    await authoring.updateDefinition()
    close()
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : panels.value.textStyleSaveFailed
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <PanelGrid v-if="visible" class="mb-field-group">
    <PanelFieldGroup :label="label">
      <AppPickerField
        :key="authoring.authoringTargetId.value"
        :model-value="value"
        :items="options"
        :label="label"
        :search-placeholder="panels.searchStyles"
        :empty-label="panels.noStylesFound"
        :close-label="common.close"
        :data-property="`${kind}-style`"
        @update:model-value="update"
      >
        <template v-if="kind === 'text'" #footer="{ close }">
          <div class="flex flex-col gap-2 border-t border-border p-2">
            <form
              v-if="creating"
              class="flex flex-col gap-field-label"
              @submit.prevent="create(close)"
            >
              <PanelFieldGroup :label="panels.textStyleName" :for="inputId">
                <div class="flex min-w-0 items-center gap-1">
                  <AppInput
                    :id="inputId"
                    v-model="name"
                    :aria-label="panels.textStyleName"
                    size="xs"
                    class="min-w-0 flex-1"
                    autofocus
                  />
                  <IconButton :label="panels.create" type="submit" :disabled="!name.trim()">
                    <icon-lucide-check class="size-3.5 text-success" />
                  </IconButton>
                  <IconButton :label="panels.cancel" @click="creating = false">
                    <icon-lucide-x class="size-3.5 text-error" />
                  </IconButton>
                </div>
              </PanelFieldGroup>
            </form>
            <template v-else>
              <AppButton :disabled="!authoring.canCreate.value || saving" @click="startCreating">
                {{ panels.createTextStyle }}
              </AppButton>
              <AppButton
                :disabled="!authoring.canUpdate.value"
                :loading="saving"
                @click="updateDefinition(close)"
              >
                {{ panels.updateTextStyle }}
              </AppButton>
            </template>
            <AppAlert
              v-if="error"
              tone="error"
              :heading="panels.textStyleSaveFailed"
              :description="error"
            />
          </div>
        </template>
      </AppPickerField>
    </PanelFieldGroup>
  </PanelGrid>
</template>
