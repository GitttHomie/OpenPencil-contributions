<script setup lang="ts">
import {
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuRoot,
  DropdownMenuTrigger
} from 'reka-ui'
import { ref, watch } from 'vue'

import type { ComponentPropertyType } from '@open-pencil/scene-graph'
import { usePanelMessages, useRetainedActivity, useRetainedPopup } from '@open-pencil/vue'

import AppButton from '@/components/ui/button/AppButton.vue'
import { useMenuUI } from '@/components/ui/menu/menu'
import PanelFieldGroup from '@/components/ui/panel/PanelFieldGroup.vue'

import PropertyNameForm from './PropertyNameForm.vue'
import PropertyTypeSelect from './PropertyTypeSelect.vue'
import PropertyValueField from './PropertyValueField.vue'
const { disabled, options, create } = defineProps<{
  disabled?: boolean
  options: { value: string; label: string; disabled?: boolean }[]
  create: (name: string, type: ComponentPropertyType, value: string) => string | null
}>()
const panels = usePanelMessages()
const creating = ref<'new' | 'nested' | null>(null)
const { open, portalActive } = useRetainedPopup()
const menu = useMenuUI({ content: 'min-w-48' })
const kind = ref<ComponentPropertyType>('TEXT')
const value = ref('')
watch(kind, (kind) => {
  if (kind === 'BOOLEAN') value.value = 'false'
  else if (kind === 'INSTANCE_SWAP') value.value = options[0]?.value ?? ''
  else value.value = ''
})
const active = useRetainedActivity()
if (active)
  watch(active, (active) => {
    if (!active) creating.value = null
  })
function start() {
  kind.value = 'TEXT'
  value.value = ''
  creating.value = 'new'
}
</script>
<template>
  <DropdownMenuRoot v-model:open="open">
    <DropdownMenuTrigger as-child>
      <AppButton size="xs" variant="ghost" class="justify-start" :disabled="disabled">
        <icon-lucide-plus class="size-3.5" />{{ panels.createComponentProperty }}
        <icon-lucide-chevron-down class="ml-auto size-3.5" />
      </AppButton>
    </DropdownMenuTrigger>
    <DropdownMenuPortal v-if="portalActive">
      <DropdownMenuContent align="start" :side-offset="4" :class="menu.content">
        <DropdownMenuItem :class="menu.item" @select="start">
          <icon-lucide-plus class="size-3.5" />New property
        </DropdownMenuItem>
        <DropdownMenuItem :class="menu.item" @select="creating = 'nested'">
          <icon-lucide-link class="size-3.5" />Expose nested property
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenuPortal>
  </DropdownMenuRoot>
  <PropertyNameForm
    v-if="creating === 'new'"
    actions-placement="footer"
    :disabled="disabled"
    :create="(name) => create(name, kind, value)"
    @created="creating = null"
    @cancel="creating = null"
  >
    <template #type>
      <PropertyTypeSelect v-model="kind" :allow-swap="!!options.length" :disabled="disabled" />
    </template>
    <PanelFieldGroup :label="kind === 'BOOLEAN' ? undefined : panels.componentPropertyDefault">
      <div class="flex items-center gap-2">
        <span v-if="kind === 'BOOLEAN'" class="flex-1 text-xs text-muted">{{
          panels.componentPropertyDefault
        }}</span>
        <PropertyValueField
          :kind="kind"
          :value="value"
          :label="panels.componentPropertyDefault"
          :options="options"
          :disabled="disabled"
          @update="value = $event"
        />
      </div>
    </PanelFieldGroup>
  </PropertyNameForm>
  <slot v-if="creating === 'nested'" name="nested" :close="() => (creating = null)" />
</template>
