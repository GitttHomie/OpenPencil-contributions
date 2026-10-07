<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import type { VariantPropertyControl } from '@open-pencil/vue'
import { usePanelMessages } from '@open-pencil/vue'

import AppButton from '@/components/ui/button/AppButton.vue'
import IconButton from '@/components/ui/button/IconButton.vue'
import AppAlert from '@/components/ui/feedback/AppAlert.vue'
import AppInput from '@/components/ui/input/AppInput.vue'
import PanelFieldGroup from '@/components/ui/panel/PanelFieldGroup.vue'
import ReorderList from '@/components/ui/panel/ReorderList.vue'
import AppSelect from '@/components/ui/select/AppSelect.vue'
import { squareControlSize } from '@/theme/control'

const { definition, add, rename, remove, reorder } = defineProps<{
  definition: VariantPropertyControl
  add: (value: string) => boolean
  rename: (old: string, value: string) => boolean
  remove: (value: string, replacement?: string) => boolean
  reorder: (values: string[]) => boolean
}>()
const panels = usePanelMessages()
const drafts = ref<Record<string, string>>({})
const newValue = ref('')
const invalid = ref(false)
const deleting = ref<string | null>(null)
const replacement = ref('')
const items = computed(() => definition.values.map((value) => ({ id: value, name: value })))
const replacements = computed(() =>
  definition.values
    .filter((value) => value !== deleting.value)
    .map((value) => ({ value, label: value }))
)
watch(
  () => definition.values,
  (values) => {
    drafts.value = Object.fromEntries(values.map((value) => [value, value]))
    if (deleting.value && !values.includes(deleting.value)) deleting.value = null
  },
  { immediate: true }
)
function commit(old: string) {
  const value = drafts.value[old]?.trim() ?? ''
  if (old === value) return
  invalid.value = !rename(old, value)
  if (invalid.value) drafts.value[old] = old
}
function create() {
  invalid.value = !add(newValue.value)
  if (!invalid.value) newValue.value = ''
}
function move(id: string, index: number) {
  const values = definition.values.filter((value) => value !== id)
  values.splice(index, 0, id)
  reorder(values)
}
function requestDelete(value: string) {
  invalid.value = false
  if (definition.usage[value]) {
    deleting.value = value
    replacement.value = ''
  } else remove(value)
}
function confirmDelete() {
  if (deleting.value && remove(deleting.value, replacement.value)) deleting.value = null
}
</script>

<template>
  <PanelFieldGroup :label="panels.variantValues">
    <ReorderList :items="items" density="compact" @move="move">
      <template #default="{ item }">
        <div class="flex items-center gap-1" :data-variant-value="item.id">
          <AppInput
            v-model="drafts[item.id]"
            size="xs"
            tone="panel"
            :aria-label="panels.variantValueName"
            @change="commit(item.id)"
            @enter="commit(item.id)"
          />
          <IconButton :label="panels.removeVariantValue" @click="requestDelete(item.id)"
            ><icon-lucide-trash-2 class="size-3.5"
          /></IconButton>
        </div>
      </template>
    </ReorderList>
    <form class="flex items-center gap-1" @submit.prevent="create">
      <span :class="[squareControlSize.xs, 'shrink-0']" aria-hidden="true" />
      <AppInput
        v-model="newValue"
        size="xs"
        tone="panel"
        :aria-label="panels.addVariantValue"
        :placeholder="panels.addVariantValue"
        @update:model-value="invalid = false"
      />
      <IconButton type="submit" :label="panels.addVariantValue" :disabled="!newValue.trim()"
        ><icon-lucide-check class="size-3.5 text-success"
      /></IconButton>
    </form>
    <p v-if="invalid" role="alert" class="text-[11px] text-error">{{ panels.variantValueError }}</p>
  </PanelFieldGroup>
  <div
    v-if="deleting !== null"
    class="flex flex-col gap-field-group rounded bg-panel-secondary p-2"
    :data-removing-value="deleting"
  >
    <AppAlert
      tone="info"
      :heading="`${panels.removeVariantValue}: ${deleting}`"
      :description="panels.variantReplacementHelp"
    />
    <PanelFieldGroup :label="panels.variantReplacement">
      <AppSelect
        v-model="replacement"
        :label="panels.variantReplacement"
        :options="replacements"
        :placeholder="panels.variantReplacement"
      />
    </PanelFieldGroup>
    <div class="grid grid-cols-2 gap-2">
      <AppButton size="xs" @click="deleting = null"
        ><icon-lucide-x class="size-3.5 text-error" />{{ panels.cancel }}</AppButton
      >
      <AppButton size="xs" :disabled="!replacement" @click="confirmDelete"
        ><icon-lucide-check class="size-3.5 text-success" />{{
          panels.removeVariantValue
        }}</AppButton
      >
    </div>
  </div>
</template>
