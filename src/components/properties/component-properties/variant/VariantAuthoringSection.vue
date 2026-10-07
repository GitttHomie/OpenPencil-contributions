<script setup lang="ts">
import { ref, watch } from 'vue'

import { usePanelMessages, useVariantAuthoring } from '@open-pencil/vue'

import AppButton from '@/components/ui/button/AppButton.vue'
import IconButton from '@/components/ui/button/IconButton.vue'
import PanelFieldGroup from '@/components/ui/panel/PanelFieldGroup.vue'
import PanelSection from '@/components/ui/panel/PanelSection.vue'
import ReorderList from '@/components/ui/panel/ReorderList.vue'
import AppSelect from '@/components/ui/select/AppSelect.vue'

import PropertyNameForm from '../PropertyNameForm.vue'
import Conflicts from './Conflicts.vue'
import PropertyCard from './PropertyCard.vue'

const {
  active,
  standalone,
  componentSet,
  variant,
  definitions,
  conflicts,
  selectVariant,
  addProperty,
  renameProperty,
  removeProperty,
  reorderProperties,
  addValue,
  renameValue,
  removeValue,
  reorderValues,
  setVariantValue,
  addVariant,
  duplicateVariant
} = useVariantAuthoring()
const panels = usePanelMessages()
const creating = ref(false)
watch([() => componentSet.value?.id, () => variant.value?.id], () => {
  creating.value = false
})
const expanded = ref(new Set<string>())
function key(id: string) {
  return `${componentSet.value?.id}:${id}`
}
function setOpen(id: string, open: boolean) {
  if (open) expanded.value.add(key(id))
  else expanded.value.delete(key(id))
}
function create(name: string) {
  const id = addProperty(name)
  if (id) setOpen(id, true)
  return id ?? null
}
function move(id: string, index: number) {
  const ids = definitions.value.map((item) => item.id).filter((value) => value !== id)
  ids.splice(index, 0, id)
  reorderProperties(ids)
}
</script>

<template>
  <PanelSection v-if="standalone" :label="panels.variants">
    <AppButton size="xs" variant="soft" @click="addVariant()"
      ><icon-lucide-plus class="size-3.5" />{{ panels.addVariant }}</AppButton
    >
  </PanelSection>
  <PanelSection
    v-if="active"
    :key="componentSet?.id"
    :label="panels.variants"
    :ui="{ title: 'text-component' }"
  >
    <template v-if="variant" #actions>
      <IconButton :label="panels.duplicateVariant" @click="duplicateVariant()"
        ><icon-lucide-plus class="size-3.5"
      /></IconButton>
    </template>
    <div class="flex flex-col gap-field-group">
      <Conflicts :components="conflicts" @select="selectVariant" />
      <template v-if="variant">
        <PanelFieldGroup
          v-for="definition in definitions"
          :key="definition.id"
          :label="definition.name"
        >
          <AppSelect
            :model-value="variant.componentPropertyValues[definition.name] ?? ''"
            :options="definition.values.map((value) => ({ value, label: value }))"
            :label="definition.name"
            :data-property="definition.id"
            :aria-invalid="conflicts.some((node) => node.id === variant?.id) || undefined"
            @update:model-value="setVariantValue(definition.id, $event)"
          />
        </PanelFieldGroup>
      </template>
      <template v-else>
        <AppButton
          v-if="!creating"
          size="xs"
          variant="ghost"
          class="justify-start"
          @click="creating = true"
          ><icon-lucide-plus class="size-3.5" />{{ panels.addVariantProperty }}</AppButton
        >
        <PropertyNameForm
          v-else
          :create="create"
          @created="creating = false"
          @cancel="creating = false"
        />
        <ReorderList :items="definitions" @move="move">
          <template #default="{ item }">
            <PropertyCard
              :definition="item"
              :open="expanded.has(key(item.id))"
              :rename="(name) => renameProperty(item.id, name)"
              :add-value="(value) => addValue(item.id, value)"
              :rename-value="(old, value) => renameValue(item.id, old, value)"
              :remove-value="(value, replacement) => removeValue(item.id, value, replacement)"
              :reorder-values="(values) => reorderValues(item.id, values)"
              @remove="removeProperty(item.id)"
              @update:open="setOpen(item.id, $event)"
            />
          </template>
        </ReorderList>
        <AppButton size="xs" variant="soft" @click="addVariant()"
          ><icon-lucide-plus class="size-3.5" />{{ panels.addVariant }}</AppButton
        >
      </template>
    </div>
  </PanelSection>
</template>
