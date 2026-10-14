<script setup lang="ts">
import type { Variable } from '@open-pencil/scene-graph'
import { useI18n } from '@open-pencil/vue'

import { useFontToken } from '@/app/editor/tokens/font'
import FontPicker from '@/components/font-picker/FontPicker.vue'
import { BindingPill } from '@/components/ui/binding'
import AppSelect from '@/components/ui/select/AppSelect.vue'

const { variable, modeId, label } = defineProps<{
  variable: Variable
  modeId: string
  label: string
}>()
const emit = defineEmits<{ update: [value: string | number] }>()
const { family, value, weights } = useFontToken(
  () => variable,
  () => modeId
)
const { panels } = useI18n()
</script>

<template>
  <div class="flex min-w-0 flex-col gap-field-label">
    <template v-if="variable.fontFamilyVariableId">
      <div class="flex min-w-0 items-center gap-2">
        <span class="text-xs text-muted">{{ panels.fontFamily }}</span>
        <BindingPill
          :label="family.name || panels.unresolvedVariable"
          :value="family.value"
          :unresolved="!family.value"
        />
      </div>
      <AppSelect
        :label="label"
        :model-value="String(value ?? '')"
        :options="weights"
        @update:model-value="emit('update', Number($event))"
      />
    </template>
    <FontPicker
      v-else
      :label="label"
      :model-value="typeof value === 'string' ? value : ''"
      @select="emit('update', $event)"
    />
  </div>
</template>
