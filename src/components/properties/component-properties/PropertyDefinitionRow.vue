<script setup lang="ts">
import { CollapsibleContent, CollapsibleRoot, CollapsibleTrigger } from 'reka-ui'
import { ref, watch } from 'vue'

import type { ComponentPropertyType } from '@open-pencil/scene-graph'
import { usePanelMessages } from '@open-pencil/vue'

import IconButton from '@/components/ui/button/IconButton.vue'
import AppInput from '@/components/ui/input/AppInput.vue'
import PanelFieldGroup from '@/components/ui/panel/PanelFieldGroup.vue'
import { collapsibleContentMotion } from '@/theme/collapsible/collapsible'

import PropertyTypeIcon from './PropertyTypeIcon.vue'
import PropertyValueField from './PropertyValueField.vue'

const { name, sourceName, typeLabel, kind, value, options, disabled, rename, focusRequest } =
  defineProps<{
    name: string
    sourceName?: string
    kind: ComponentPropertyType
    value: string
    options: { value: string; label: string; disabled?: boolean }[]
    typeLabel: string
    disabled?: boolean
    focusRequest?: number
    rename?: (name: string) => boolean
  }>()
defineEmits<{ remove: []; update: [value: string] }>()
const open = defineModel<boolean>('open', { default: false })
const panels = usePanelMessages()
const draft = ref(name)
const invalid = ref(false)
watch(
  () => name,
  (value) => {
    draft.value = value
  }
)
function commit() {
  invalid.value = !rename?.(draft.value)
  if (!invalid.value) draft.value = draft.value.trim()
}
</script>

<template>
  <CollapsibleRoot v-model:open="open" class="overflow-hidden rounded border border-border">
    <div class="flex flex-col gap-1.5 p-2">
      <div class="flex items-center gap-1">
        <CollapsibleTrigger as-child>
          <IconButton :label="`${panels.componentProperties}: ${name}`">
            <icon-lucide-chevron-right
              class="size-3.5 transition-transform data-[open]:rotate-90 motion-reduce:transition-none"
              :data-open="open || undefined"
              aria-hidden="true"
            />
          </IconButton>
        </CollapsibleTrigger>
        <div v-if="sourceName" class="flex min-w-0 flex-1 items-center gap-1 text-xs">
          <icon-lucide-component class="size-3.5 shrink-0 text-component" />
          <div class="min-w-0">
            <div class="truncate text-muted">{{ sourceName }}</div>
            <div class="truncate">{{ name }}</div>
          </div>
        </div>
        <div v-else class="flex shrink-0 items-center gap-1">
          <span role="img" :aria-label="typeLabel" class="inline-flex shrink-0 items-center">
            <icon-lucide-toggle-left
              v-if="kind === 'BOOLEAN'"
              class="size-3.5 text-muted"
              aria-hidden="true"
            />
            <PropertyTypeIcon v-else :kind="kind" />
          </span>
          <span class="text-[10px] text-muted">{{ typeLabel }}</span>
        </div>
        <AppInput
          v-if="!sourceName"
          v-model="draft"
          size="xs"
          tone="panel"
          :aria-label="panels.componentPropertyName"
          :state="invalid ? 'invalid' : 'idle'"
          :aria-invalid="invalid"
          :disabled="disabled"
          @change="commit"
          @enter="commit"
          @update:model-value="invalid = false"
        />
        <IconButton
          :label="
            sourceName ? `Stop exposing ${sourceName} / ${name}` : panels.deleteComponentProperty
          "
          :disabled="disabled"
          @click="$emit('remove')"
        >
          <icon-lucide-trash-2 class="size-3.5" />
        </IconButton>
      </div>
      <p v-if="invalid" role="alert" class="text-[11px] text-error">
        {{ panels.componentPropertyNameError }}
      </p>
    </div>
    <CollapsibleContent :class="collapsibleContentMotion">
      <div class="border-t border-border p-2" :data-property-type="kind">
        <PanelFieldGroup :label="kind === 'BOOLEAN' ? undefined : panels.componentPropertyDefault">
          <div class="flex items-center gap-2">
            <span v-if="kind === 'BOOLEAN'" class="flex-1 text-xs text-muted">{{
              panels.componentPropertyDefault
            }}</span>
            <PropertyValueField
              :focus-request="focusRequest"
              :kind="kind"
              :value="value"
              :label="panels.componentPropertyDefault"
              :options="options"
              :disabled="disabled"
              @update="$emit('update', $event)"
            />
          </div>
        </PanelFieldGroup>
      </div>
      <div v-if="$slots.default" class="flex flex-col gap-1 border-t border-border p-2">
        <slot />
      </div>
    </CollapsibleContent>
  </CollapsibleRoot>
</template>
