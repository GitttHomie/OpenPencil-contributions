<script setup lang="ts">
import { PopoverContent, PopoverPortal, PopoverRoot, PopoverTrigger } from 'reka-ui'
import type { PopoverContentEmits } from 'reka-ui'
import { tv } from 'tailwind-variants'

import type { Fill } from '@open-pencil/scene-graph'
import { applySolidFillColor, FillRoot, useI18n, useRetainedPopup } from '@open-pencil/vue'
import type { OkHCLControls } from '@open-pencil/vue'

import type { GradientTarget } from '@/app/editor/gradient/editing'
import { useCanvasGradientPicker } from '@/app/editor/gradient/picker'
import ColorPickerPanel from '@/components/color-picker-panel/ColorPickerPanel.vue'
import GradientEditor from '@/components/fill-picker/GradientEditor.vue'
import ImageFillPicker from '@/components/fill-picker/ImageFillPicker.vue'
import { usePopoverUI } from '@/components/ui/overlay/popover'
import Tip from '@/components/ui/overlay/Tip.vue'
import FillSwatchTrigger from '@/components/ui/paint/FillSwatchTrigger.vue'
import fillPickerTheme from '@/theme/fill-picker'

const fillPicker = tv(fillPickerTheme)

function tabClass(active: boolean) {
  return fillPicker({ active }).tab()
}

const {
  fill,
  okhcl = null,
  swatchBackground,
  gradientTarget
} = defineProps<{
  fill: Fill
  okhcl?: OkHCLControls | null
  swatchBackground?: string
  gradientTarget?: GradientTarget
}>()
const emit = defineEmits<{
  update: [fill: Fill]
  openChange: [open: boolean]
  cancel: []
  canvasGesture: []
}>()
const { open: popupOpen, portalActive } = useRetainedPopup(undefined, () => {
  emit('cancel')
  emit('openChange', false)
})
const cls = usePopoverUI({ content: 'w-60 p-2' })
const { panels } = useI18n()
useCanvasGradientPicker(
  () => popupOpen.value && fill.type.startsWith('GRADIENT'),
  () => gradientTarget,
  () => emit('canvasGesture')
)

function keepGradientOpen(event: PopoverContentEmits['interactOutside'][0]) {
  const target = event.detail.originalEvent.target
  if (target instanceof Element && target.closest('[data-gradient-editor]')) event.preventDefault()
}

function cancelFromEscape(event: KeyboardEvent) {
  event.stopPropagation()
  emit('cancel')
}
</script>

<template>
  <FillRoot :fill="fill" @update="emit('update', $event)" v-slot="root">
    <PopoverRoot v-model:open="popupOpen" @update:open="emit('openChange', $event)">
      <PopoverTrigger as-child>
        <FillSwatchTrigger
          :fill="fill"
          :label="panels.fill"
          :background="swatchBackground"
          data-test-id="fill-picker-swatch"
        />
      </PopoverTrigger>

      <PopoverPortal v-if="portalActive">
        <PopoverContent
          :class="cls.content"
          :side-offset="4"
          side="left"
          data-picker-content
          @escape-key-down="cancelFromEscape"
          @interact-outside="keepGradientOpen"
        >
          <div class="mb-2 flex items-center gap-0.5">
            <Tip :label="panels.solid">
              <button
                :data-active="root.category === 'SOLID' || undefined"
                :class="tabClass(root.category === 'SOLID')"
                data-test-id="fill-picker-tab-solid"
                @click="root.actions.toSolid"
              >
                <icon-lucide-square class="size-3.5" />
              </button>
            </Tip>
            <Tip :label="panels.linearGradient">
              <button
                :data-active="root.category === 'GRADIENT' || undefined"
                :class="tabClass(root.category === 'GRADIENT')"
                data-test-id="fill-picker-tab-gradient"
                @click="root.actions.toGradient"
              >
                <icon-lucide-blend class="size-3.5" />
              </button>
            </Tip>
            <Tip :label="panels.image">
              <button
                :data-active="root.category === 'IMAGE' || undefined"
                :class="tabClass(root.category === 'IMAGE')"
                data-test-id="fill-picker-tab-image"
                @click="root.actions.toImage"
              >
                <icon-lucide-image class="size-3.5" />
              </button>
            </Tip>
          </div>

          <ColorPickerPanel
            v-if="root.category === 'SOLID'"
            :color="root.fill.color"
            :okhcl="okhcl"
            @update="emit('update', applySolidFillColor(root.fill, $event))"
          />

          <GradientEditor
            v-if="root.category === 'GRADIENT'"
            :fill="root.fill"
            @update="emit('update', $event)"
          />
          <p
            v-if="root.category === 'GRADIENT' && gradientTarget"
            class="mt-2 text-[10px] text-muted"
          >
            {{ panels.gradientCanvasHint }}
          </p>

          <ImageFillPicker
            v-if="root.category === 'IMAGE'"
            :fill="root.fill"
            @update="emit('update', $event)"
          />
        </PopoverContent>
      </PopoverPortal>
    </PopoverRoot>
  </FillRoot>
</template>
