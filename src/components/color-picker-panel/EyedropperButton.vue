<script setup lang="ts">
import type { Color } from '@open-pencil/scene-graph'

import { useScreenColorSampler } from '@/app/editor/color-sampling/use'
import IconButton from '@/components/ui/button/IconButton.vue'
import Tip from '@/components/ui/overlay/Tip.vue'

const { color } = defineProps<{ color: Color }>()
const emit = defineEmits<{ pick: [color: Color] }>()
const { supported, active, error, pick } = useScreenColorSampler((color) => emit('pick', color))
</script>

<template>
  <Tip
    :label="
      !supported
        ? 'Screen color sampling is unavailable in this browser'
        : error
          ? 'Could not sample a color. Try again.'
          : 'Pick color from screen'
    "
  >
    <IconButton
      label="Pick color from screen"
      :disabled="!supported || active"
      :active="active"
      @click="pick(color.a)"
    >
      <icon-lucide-pipette class="size-3.5" />
    </IconButton>
  </Tip>
</template>
