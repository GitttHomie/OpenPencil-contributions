<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import type { Editor } from '@open-pencil/core/editor'

import AppButton from '@/components/ui/button/AppButton.vue'
import PanelFieldGroup from '@/components/ui/panel/PanelFieldGroup.vue'
import AppSelect from '@/components/ui/select/AppSelect.vue'
import AppSwitch from '@/components/ui/toggle/AppSwitch.vue'

import PropertyTypeIcon from './PropertyTypeIcon.vue'

const { ownerId, candidates, disabled, update } = defineProps<{
  ownerId: string
  candidates: ReturnType<Editor['getNestedComponentPropertyCandidates']>
  disabled?: boolean
  update: Editor['setNestedComponentPropertyExposure']
}>()
defineEmits<{ done: [] }>()
const selected = ref('')
const options = computed(() => candidates.map((item) => ({ value: item.id, label: item.name })))
const current = computed(() => candidates.find((item) => item.id === selected.value))
watch(
  options,
  (items) => {
    if (!items.some((item) => item.value === selected.value)) selected.value = items[0]?.value ?? ''
  },
  { immediate: true }
)
function toggle(propertyId: string, checked: boolean) {
  const candidate = current.value
  if (!candidate || disabled) return
  const ids = new Set(candidate.exposed)
  if (checked) ids.add(propertyId)
  else ids.delete(propertyId)
  update(ownerId, candidate.id, [...ids])
}
</script>

<template>
  <div class="flex flex-col gap-field-group rounded-md bg-panel-field p-2">
    <p v-if="!candidates.length" class="text-xs text-muted">No nested component instances.</p>
    <template v-else>
      <PanelFieldGroup label="Nested component">
        <AppSelect v-model="selected" label="Nested component" :options="options" />
      </PanelFieldGroup>
      <p v-if="!current?.properties.length" class="text-xs text-muted">
        This nested component has no exposed properties.
      </p>
      <label
        v-for="property in current?.properties"
        :key="property.id"
        class="flex min-h-field items-center gap-2 text-xs text-surface"
      >
        <PropertyTypeIcon :kind="property.type" />
        <span class="min-w-0 flex-1 truncate">{{ property.name }}</span>
        <AppSwitch
          :label="`Expose ${property.name}`"
          :model-value="current?.exposed.includes(property.id) ?? false"
          :disabled="disabled"
          @update:model-value="toggle(property.id, $event)"
        />
      </label>
    </template>
    <AppButton size="xs" variant="soft" @click="$emit('done')">Done</AppButton>
  </div>
</template>
