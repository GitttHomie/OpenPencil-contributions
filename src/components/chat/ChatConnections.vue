<script setup lang="ts">
import { PopoverRoot, PopoverTrigger, PopoverPortal, PopoverContent } from 'reka-ui'
import { ref } from 'vue'

import { useAutomationMessages } from '@open-pencil/vue'

import { useAIChat } from '@/app/ai/chat/use'
import { enabledMCPConnections } from '@/app/integrations/mcp'
import IconButton from '@/components/ui/button/IconButton.vue'
import { usePopoverUI } from '@/components/ui/overlay/popover'
import AppSwitch from '@/components/ui/toggle/AppSwitch.vue'

const { disabled = false } = defineProps<{ disabled?: boolean }>()
const open = ref(false)
const automation = useAutomationMessages()
const { history } = useAIChat()
const selectedMCPConnectionIds = history.connectionIds
const ui = usePopoverUI({ content: 'w-72 p-3' })
function toggle(id: string, enabled: boolean) {
  const ids = selectedMCPConnectionIds.value.filter((candidate) => candidate !== id)
  history.setMCPConnections(enabled ? [...ids, id] : ids)
}
</script>

<template>
  <PopoverRoot v-model:open="open">
    <PopoverTrigger as-child>
      <IconButton
        :label="automation.chatConnections"
        :active="selectedMCPConnectionIds.length > 0"
        :disabled="disabled"
        size="sm"
      >
        <icon-lucide-plug class="size-3.5" />
      </IconButton>
    </PopoverTrigger>
    <PopoverPortal>
      <PopoverContent
        :class="ui.content"
        side="top"
        :side-offset="8"
        :aria-label="automation.chatConnections"
      >
        <div class="flex flex-col gap-3">
          <span class="text-xs font-medium">{{ automation.chatConnections }}</span>
          <p v-if="!enabledMCPConnections.length" class="text-xs text-muted">
            {{ automation.noChatConnections }}
          </p>
          <label
            v-for="connection in enabledMCPConnections"
            :key="connection.id"
            class="flex items-center justify-between gap-3 text-xs"
          >
            <span class="truncate">{{ connection.name }}</span>
            <AppSwitch
              :model-value="selectedMCPConnectionIds.includes(connection.id)"
              :label="connection.name"
              :disabled="disabled"
              @update:model-value="toggle(connection.id, $event)"
            />
          </label>
        </div>
      </PopoverContent>
    </PopoverPortal>
  </PopoverRoot>
</template>
