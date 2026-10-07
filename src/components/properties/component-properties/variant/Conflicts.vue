<script setup lang="ts">
import { usePanelMessages } from '@open-pencil/vue'

import AppButton from '@/components/ui/button/AppButton.vue'
import AppAlert from '@/components/ui/feedback/AppAlert.vue'

const { components } = defineProps<{ components: { id: string; name: string }[] }>()
defineEmits<{ select: [id: string] }>()
const panels = usePanelMessages()
</script>

<template>
  <AppAlert
    v-if="components.length"
    tone="warning"
    :heading="panels.duplicateVariantValues"
    :description="panels.variantConflictHelp"
  >
    <template #details>
      <div class="flex flex-col gap-1">
        <AppButton
          v-for="node in components"
          :key="node.id"
          size="xs"
          variant="ghost"
          class="w-full justify-start"
          :data-node-id="node.id"
          @click="$emit('select', node.id)"
        >
          <icon-lucide-component class="size-3.5 shrink-0" />
          <span class="min-w-0 truncate">{{ node.name || panels.component }} · {{ node.id }}</span>
        </AppButton>
      </div>
    </template>
  </AppAlert>
</template>
