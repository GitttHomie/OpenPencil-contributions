<script setup lang="ts">
import { ref, useId } from 'vue'

import { usePanelMessages } from '@open-pencil/vue'

import AppButton from '@/components/ui/button/AppButton.vue'
import IconButton from '@/components/ui/button/IconButton.vue'
import AppInput from '@/components/ui/input/AppInput.vue'
import PanelFieldGroup from '@/components/ui/panel/PanelFieldGroup.vue'
const {
  suggestedName = '',
  actionsPlacement = 'inline',
  disabled,
  create
} = defineProps<{
  suggestedName?: string
  actionsPlacement?: 'inline' | 'footer'
  disabled?: boolean
  create: (name: string) => string | null
}>()
const emit = defineEmits<{ cancel: []; created: [] }>()
const panels = usePanelMessages()
const inputId = useId()
const name = ref(suggestedName)
const invalid = ref(false)
function submit() {
  if (disabled) return
  invalid.value = !create(name.value)
  if (!invalid.value) emit('created')
}
</script>
<template>
  <form
    class="flex min-w-0 flex-col gap-field-group rounded-md smooth-corners bg-panel-secondary p-2"
    @submit.prevent="submit"
  >
    <div class="flex min-w-0 items-start gap-2">
      <PanelFieldGroup
        v-if="$slots.type"
        :label="panels.componentPropertyType"
        class="min-w-0 flex-1"
      >
        <slot name="type" />
      </PanelFieldGroup>
      <PanelFieldGroup :label="panels.componentPropertyName" :for="inputId" class="min-w-0 flex-1">
        <div class="flex min-w-0 items-center gap-1">
          <AppInput
            :id="inputId"
            v-model="name"
            :aria-label="panels.componentPropertyName"
            :aria-invalid="invalid"
            :state="invalid ? 'invalid' : 'idle'"
            :disabled="disabled"
            tone="panel"
            size="xs"
            @update:model-value="invalid = false"
          />
          <template v-if="actionsPlacement === 'inline'">
            <IconButton
              type="submit"
              size="xs"
              :label="panels.create"
              :disabled="disabled || !name.trim()"
            >
              <icon-lucide-check class="size-3.5 text-success" />
            </IconButton>
            <IconButton size="xs" :label="panels.cancel" @click="emit('cancel')">
              <icon-lucide-x class="size-3.5 text-error" />
            </IconButton>
          </template>
        </div>
        <p v-if="invalid" role="alert" class="text-[11px] text-error">
          {{ panels.componentPropertyNameError }}
        </p>
      </PanelFieldGroup>
    </div>
    <slot />
    <div v-if="actionsPlacement === 'footer'" class="grid grid-cols-2 gap-2">
      <AppButton size="xs" variant="ghost" @click="emit('cancel')">
        <icon-lucide-x class="size-3.5 text-error" />
        {{ panels.cancel }}
      </AppButton>
      <AppButton type="submit" size="xs" variant="ghost" :disabled="disabled || !name.trim()">
        <icon-lucide-check class="size-3.5 text-success" />
        {{ panels.create }}
      </AppButton>
    </div>
  </form>
</template>
