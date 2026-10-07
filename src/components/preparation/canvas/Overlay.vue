<script setup lang="ts">
import { ProgressIndicator, ProgressRoot } from 'reka-ui'
import { computed } from 'vue'

import type { EditorPreparation } from '@/app/editor/preparation/types'
import { resolvedAppTheme } from '@/app/shell/theme'
import BrandMark from '@/components/brand/BrandMark.vue'
import { preparationLabel, preparationPercent } from '@/components/preparation/presentation'
import { preparationScreen } from '@/theme/preparation/screen'

const { preparation } = defineProps<{
  preparation: EditorPreparation
}>()

const label = computed(() => preparationLabel(preparation))
const progressValue = computed(() => preparationPercent(preparation.progress))
const progressSteps = computed(() => Math.round(progressValue.value ?? 0))
const ui = preparationScreen()
</script>

<template>
  <Transition
    leave-active-class="transition-opacity duration-300 motion-reduce:transition-none"
    leave-to-class="opacity-0"
  >
    <div
      data-test-id="canvas-loading"
      role="status"
      aria-live="polite"
      :aria-label="label"
      :class="ui.root()"
    >
      <div :class="ui.content()">
        <BrandMark
          variant="app-icon"
          :appearance="resolvedAppTheme"
          decorative
          :class="ui.artwork()"
        />
        <div class="space-y-1">
          <p :class="ui.label()">{{ label }}</p>
          <p v-if="preparation.detail" :class="ui.detail()">
            {{ preparation.detail }}
          </p>
        </div>
        <ProgressRoot :model-value="progressValue" :class="ui.track()">
          <ProgressIndicator v-if="progressValue === null" :class="ui.indicator()" />
          <div v-else class="flex h-full w-full">
            <span
              v-for="step in 100"
              :key="step"
              :data-complete="step <= progressSteps"
              :class="ui.step()"
            />
          </div>
        </ProgressRoot>
        <p v-if="progressValue !== null" :class="ui.count()">
          {{ preparation.progress?.completed }} of {{ preparation.progress?.total }}
        </p>
      </div>
    </div>
  </Transition>
</template>
