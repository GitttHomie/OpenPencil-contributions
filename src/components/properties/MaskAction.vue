<script setup lang="ts">
import { useEditorCommands } from '@open-pencil/vue'

import IconButton from '@/components/ui/button/IconButton.vue'

const { getCommand, runCommand } = useEditorCommands()
const maskCommand = getCommand('selection.toggleMask')
</script>

<template>
  <IconButton
    :label="maskCommand.label"
    :disabled="!maskCommand.enabled.value"
    data-test-id="selection-toggle-mask"
    @click="runCommand('selection.toggleMask')"
  >
    <icon-lucide-shapes class="size-3.5" />
  </IconButton>
</template>
