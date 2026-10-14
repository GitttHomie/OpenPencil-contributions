<script setup lang="ts">
import { computed } from 'vue'

import type { SceneNode } from '@open-pencil/scene-graph'
import { BindableValueRoot, useFontBindingProvider, useI18n } from '@open-pencil/vue'

import VariableBindingPicker from '@/components/properties/binding/VariableBindingPicker.vue'
import { useBindingFieldUI } from '@/components/ui/binding'

const { nodes, field, value } = defineProps<{
  nodes: SceneNode[]
  field: 'fontFamily' | 'fontWeight'
  value: string | number
}>()
const { panels, common } = useI18n()
const styles = useBindingFieldUI()
const provider = useFontBindingProvider(
  field,
  computed(() => nodes)
)
const targets = computed(() => nodes.map((node) => ({ nodeId: node.id, path: field })))
</script>

<template>
  <BindableValueRoot v-slot="binding" :provider="provider" :targets="targets" :value="value">
    <div :class="styles.field" :data-property="`${field}-variable`">
      <div :class="styles.content">
        <slot
          :bound="!!binding.variable || binding.state === 'unresolved'"
          :label="binding.variable?.name ?? panels.unresolvedVariable"
          :value="binding.mixedValues ? panels.mixed : binding.resolvedValue"
          :unresolved="binding.unresolved"
          :tooltip="
            binding.variable
              ? `${binding.variable.name} · ${binding.resolvedValue ?? panels.unresolvedVariable}`
              : panels.unresolvedVariable
          "
          :ui="{ trigger: styles.control }"
        />
      </div>
      <span :class="styles.actions">
        <VariableBindingPicker
          :trigger-label="panels.applyVariable"
          :search-placeholder="common.search"
          :empty-label="panels.noVariablesFound"
          :detach-label="panels.detachVariable"
          :create-label="value === '' ? undefined : panels.createVariable"
          :create-name-placeholder="panels.variableName"
          :create-submit-label="panels.create"
        />
      </span>
    </div>
  </BindableValueRoot>
</template>
