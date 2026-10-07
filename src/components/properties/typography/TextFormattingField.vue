<script setup lang="ts">
import { useI18n } from '@open-pencil/vue'

import { appMenuShortcutLabel } from '@/app/shell/menu/shortcut'
import IconButton from '@/components/ui/button/IconButton.vue'
import PanelFieldGroup from '@/components/ui/panel/PanelFieldGroup.vue'

const { active, canToggleBold, canToggleItalic } = defineProps<{
  active: string[]
  canToggleBold: boolean
  canToggleItalic: boolean
}>()
defineEmits<{ bold: []; italic: []; decoration: [value: 'UNDERLINE' | 'STRIKETHROUGH'] }>()
const { panels, menu } = useI18n()
</script>
<template>
  <PanelFieldGroup
    :label="panels.textFormatting"
    class="mb-field-group"
    :ui="{ container: 'flex-row gap-1.5' }"
  >
    <div
      class="inline-flex items-center gap-0.5 rounded bg-panel-field p-0.5 hover:bg-panel-field-hover"
      role="toolbar"
      :aria-label="panels.textFormatting"
    >
      <IconButton
        :label="`${menu.bold} (${appMenuShortcutLabel('text.bold')})`"
        size="xs"
        :active="active.includes('bold')"
        :disabled="!canToggleBold"
        @click="$emit('bold')"
      >
        <icon-lucide-bold class="size-3.5" />
      </IconButton>
      <IconButton
        :label="`${menu.italic} (${appMenuShortcutLabel('text.italic')})`"
        size="xs"
        :active="active.includes('italic')"
        :disabled="!canToggleItalic"
        @click="$emit('italic')"
      >
        <icon-lucide-italic class="size-3.5" />
      </IconButton>
      <IconButton
        :label="`${menu.underline} (${appMenuShortcutLabel('text.underline')})`"
        size="xs"
        :active="active.includes('underline')"
        @click="$emit('decoration', 'UNDERLINE')"
      >
        <icon-lucide-underline class="size-3.5" />
      </IconButton>
      <IconButton
        :label="menu.strikethrough"
        size="xs"
        :active="active.includes('strikethrough')"
        @click="$emit('decoration', 'STRIKETHROUGH')"
      >
        <icon-lucide-strikethrough class="size-3.5" />
      </IconButton>
    </div>
  </PanelFieldGroup>
</template>
