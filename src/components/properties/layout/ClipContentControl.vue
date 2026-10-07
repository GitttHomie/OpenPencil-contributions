<script setup lang="ts">
import { useI18n, useSelectionLayout } from '@open-pencil/vue'

import AppSwitch from '@/components/ui/toggle/AppSwitch.vue'

const { merged, updateAllWithUndo } = useSelectionLayout()

const { panels } = useI18n()
</script>

<template>
  <label class="mt-2 flex items-center justify-between gap-2 text-xs text-surface">
    {{ panels.clipContent }}
    <AppSwitch
      :label="panels.clipContent"
      :model-value="merged('clipsContent') === true"
      :state="typeof merged('clipsContent') === 'symbol' ? 'mixed' : 'idle'"
      @update:model-value="updateAllWithUndo({ clipsContent: $event }, 'Toggle clip content')"
    />
  </label>
</template>
