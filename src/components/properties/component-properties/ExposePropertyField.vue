<script setup lang="ts">
import {
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuRoot,
  DropdownMenuTrigger,
  DropdownMenuSeparator
} from 'reka-ui'
import { computed, ref, watch } from 'vue'

import type { ComponentPropertyDefinition } from '@open-pencil/scene-graph'
import { usePanelMessages, useRetainedPopup } from '@open-pencil/vue'

import AppButton from '@/components/ui/button/AppButton.vue'
import { useMenuUI } from '@/components/ui/menu/menu'
import { panelFieldLabelText } from '@/theme/panel/field-group'

import PropertyNameForm from './PropertyNameForm.vue'
import PropertyTypeIcon from './PropertyTypeIcon.vue'
import PropertyValueField from './PropertyValueField.vue'

const {
  label,
  kind,
  value,
  definitions,
  propertyId,
  suggestedName,
  disabled,
  expose,
  bind,
  changeValue
} = defineProps<{
  label: string
  kind: ComponentPropertyDefinition['type']
  value: string
  definitions: ComponentPropertyDefinition[]
  propertyId?: string
  suggestedName: string
  disabled?: boolean
  expose: (name: string) => string | null
  bind: (propertyId: string | null) => boolean
  changeValue: (value: string) => void
}>()
const panels = usePanelMessages()
const { open, portalActive } = useRetainedPopup()
const menu = useMenuUI({ content: 'min-w-48 max-h-72 overflow-y-auto' })
const definition = computed(() => definitions.find((item) => item.id === propertyId))
const displayedValue = computed(() =>
  kind === 'INSTANCE_SWAP' ? value : (definition.value?.defaultValue ?? value)
)
const creating = ref(false)
const name = ref('')
watch(portalActive, (active) => {
  if (!active) creating.value = false
})
function startCreate() {
  name.value = suggestedName
  let suffix = 2
  while (definitions.some((item) => item.name === name.value))
    name.value = `${suggestedName} ${suffix++}`
  creating.value = true
}
</script>
<template>
  <div
    class="group grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-2 gap-y-field-label data-[attribute=BOOLEAN]:grid-cols-[minmax(0,1fr)_auto_auto]"
    :data-attribute="kind"
  >
    <div
      :class="[
        panelFieldLabelText,
        'col-span-full flex min-w-0 items-center gap-2 group-data-[attribute=BOOLEAN]:col-span-1 group-data-[attribute=BOOLEAN]:min-h-7'
      ]"
    >
      <PropertyTypeIcon :kind="kind" />
      <span>{{ label }}</span>
    </div>
    <div class="flex min-w-0 items-center">
      <PropertyValueField
        v-if="kind === 'BOOLEAN' || kind === 'TEXT'"
        :kind="kind"
        :value="displayedValue"
        :label="label"
        :disabled="disabled || !!propertyId"
        @update="changeValue"
      />
      <p v-else class="m-0 truncate text-xs text-muted">{{ value }}</p>
    </div>
    <div class="flex items-center border-l border-border pl-1">
      <DropdownMenuRoot v-model:open="open">
        <DropdownMenuTrigger as-child>
          <AppButton
            size="xs"
            variant="ghost"
            class="min-w-0 max-w-28"
            :color="propertyId ? 'primary' : 'neutral'"
            :data-linked="!!propertyId"
            :disabled="disabled"
            :aria-label="`${label}: ${definition?.name ?? panels.exposeAttribute}`"
          >
            <icon-lucide-link class="size-3.5 shrink-0" />
            <span class="truncate">{{ definition?.name ?? panels.exposeAttribute }}</span>
          </AppButton>
        </DropdownMenuTrigger>
        <DropdownMenuPortal v-if="portalActive">
          <DropdownMenuContent align="end" :side-offset="4" :class="menu.content">
            <DropdownMenuItem :class="menu.item" @select="startCreate">{{
              panels.createComponentProperty
            }}</DropdownMenuItem>
            <DropdownMenuSeparator v-if="definitions.length" :class="menu.separator" />
            <DropdownMenuItem
              v-for="item in definitions"
              :key="item.id"
              :class="menu.item"
              @select="bind(item.id)"
            >
              <span>{{ item.name }}</span
              ><icon-lucide-check v-if="item.id === propertyId" class="size-3" />
            </DropdownMenuItem>
            <DropdownMenuSeparator v-if="propertyId" :class="menu.separator" />
            <DropdownMenuItem v-if="propertyId" :class="menu.item" @select="bind(null)">{{
              panels.unbindComponentProperty
            }}</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenuPortal>
      </DropdownMenuRoot>
    </div>
    <PropertyNameForm
      v-if="creating"
      class="col-span-full"
      :suggested-name="name"
      :disabled="disabled"
      :create="expose"
      @created="creating = false"
      @cancel="creating = false"
    />
  </div>
</template>
