<script setup lang="ts">
import { computed } from 'vue'

import type { TokenModeValue } from '@/app/editor/tokens/model'

import FormulaReferencePill from './FormulaReferencePill.vue'
import { formulaSegments } from './source'

const { formula } = defineProps<{ formula: NonNullable<TokenModeValue['formula']> }>()
const segments = computed(() =>
  formulaSegments(formula.source, (source) => formula.references[source])
)
</script>

<template>
  <span class="min-w-0 truncate">
    <template v-for="segment in segments" :key="segment.start">
      <FormulaReferencePill v-if="segment.pill" :pill="segment.pill" />
      <template v-else>{{ segment.source }}</template>
    </template>
  </span>
</template>
