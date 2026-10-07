<script setup lang="ts">
import { CollapsibleContent, CollapsibleRoot, CollapsibleTrigger } from 'reka-ui'
import { ref, watch } from 'vue'

import type { VariantPropertyControl } from '@open-pencil/vue'
import { usePanelMessages } from '@open-pencil/vue'

import IconButton from '@/components/ui/button/IconButton.vue'
import AppInput from '@/components/ui/input/AppInput.vue'
import { collapsibleContentMotion } from '@/theme/collapsible/collapsible'
import { componentDefinitionIcon } from '@/theme/editor-icons'

import ValueList from './ValueList.vue'

const { definition, rename, addValue, renameValue, removeValue, reorderValues } = defineProps<{
  definition: VariantPropertyControl
  rename: (name: string) => boolean
  addValue: (value: string) => boolean
  renameValue: (old: string, value: string) => boolean
  removeValue: (value: string, replacement?: string) => boolean
  reorderValues: (values: string[]) => boolean
}>()
const open = defineModel<boolean>('open', { default: false })
defineEmits<{ remove: [] }>()
const panels = usePanelMessages()
const name = ref(definition.name)
const invalid = ref(false)
watch(
  () => definition.name,
  (value) => {
    name.value = value
  }
)
function commit() {
  invalid.value = !rename(name.value)
  if (invalid.value) name.value = definition.name
}
</script>

<template>
  <CollapsibleRoot
    v-model:open="open"
    class="overflow-hidden rounded border border-border"
    :data-property="definition.id"
  >
    <div class="flex items-center gap-1 p-2">
      <icon-lucide-list-filter class="size-3.5 shrink-0 text-component" />
      <AppInput
        v-model="name"
        size="xs"
        tone="panel"
        :aria-label="panels.variantPropertyName"
        :state="invalid ? 'invalid' : 'idle'"
        @change="commit"
        @enter="commit"
      />
      <IconButton :label="panels.removeVariantProperty" @click="$emit('remove')"
        ><icon-lucide-trash-2 class="size-3.5"
      /></IconButton>
    </div>
    <div class="flex min-w-0 items-start gap-1 px-2 pb-2">
      <CollapsibleTrigger as-child>
        <IconButton :label="`${panels.variantProperties}: ${definition.name}`">
          <icon-lucide-chevron-right
            class="size-3.5 transition-transform data-[open]:rotate-90 motion-reduce:transition-none"
            :data-open="open || undefined"
          />
        </IconButton>
      </CollapsibleTrigger>
      <div
        class="flex min-w-0 flex-1 flex-wrap items-start gap-x-1.5 gap-y-1 pt-1 text-[11px] text-muted"
      >
        <span
          v-for="(value, index) in definition.values"
          :key="value"
          class="inline-flex min-w-0 max-w-full items-start gap-1.5"
        >
          <span class="inline-flex min-w-0 items-start gap-1">
            <icon-lucide-diamond
              :class="componentDefinitionIcon({ class: 'mt-0.5 size-3 shrink-0 text-component' })"
              aria-hidden="true"
            />
            <span class="min-w-0 break-words">{{ value }}</span>
          </span>
          <span v-if="index < definition.values.length - 1" class="shrink-0" aria-hidden="true"
            >/</span
          >
        </span>
      </div>
    </div>
    <p v-if="invalid" role="alert" class="px-2 pb-2 text-[11px] text-error">
      {{ panels.componentPropertyNameError }}
    </p>
    <CollapsibleContent :class="collapsibleContentMotion">
      <div class="flex flex-col gap-field-group border-t border-border p-2">
        <ValueList
          :definition="definition"
          :add="addValue"
          :rename="renameValue"
          :remove="removeValue"
          :reorder="reorderValues"
        />
      </div>
    </CollapsibleContent>
  </CollapsibleRoot>
</template>
