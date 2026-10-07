<script setup lang="ts">
import { tv } from 'tailwind-variants'
import { computed } from 'vue'

import theme from '@/theme/input/textarea'

const model = defineModel<string>({ default: '' })

const {
  rows = 3,
  disabled = false,
  tone = 'default'
} = defineProps<{
  rows?: number
  disabled?: boolean
  tone?: 'default' | 'panel'
}>()
const textareaClass = computed(() => tv(theme)({ tone }))
</script>

<template>
  <textarea v-model="model" :rows="rows" :disabled="disabled" :class="textareaClass" />
</template>
