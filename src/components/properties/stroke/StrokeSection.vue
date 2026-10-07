<script setup lang="ts">
import { ref, watch } from 'vue'

import type { Color, Fill, SceneNode, Stroke } from '@open-pencil/scene-graph'
import { colorToHexRaw } from '@open-pencil/scene-graph/color'
import {
  applySolidStrokeColor,
  BORDER_WIDTH_PATHS,
  applyStrokePaint,
  BindableValueRoot,
  useColorBindingProvider,
  useI18n,
  useOkHCL,
  useStrokeControls
} from '@open-pencil/vue'
import type { BindableValueActions } from '@open-pencil/vue'

import FillPicker from '@/components/fill-picker/FillPicker.vue'
import NumberField from '@/components/inputs/NumberField.vue'
import VariableBindingPicker from '@/components/properties/binding/VariableBindingPicker.vue'
import PropertyItemRow from '@/components/properties/item-list/PropertyItemRow.vue'
import {
  applyPaintMutation,
  cancelPaintMutation,
  commitPaintMutation,
  paintBindingTargets,
  startCanvasPaintGesture
} from '@/components/properties/paint/binding'
import { createStrokeOkhclAdapter } from '@/components/properties/paint/okhcl'
import PaintField from '@/components/properties/paint/PaintField.vue'
import PaintValue from '@/components/properties/paint/PaintValue.vue'
import PropertyListRoot from '@/components/properties/PropertyListRoot.vue'
import { useSharedStylePicker } from '@/components/properties/shared-style/useSharedStylePicker'
import VariableNumberField from '@/components/properties/VariableNumberField.vue'
import IconButton from '@/components/ui/button/IconButton.vue'
import Tip from '@/components/ui/overlay/Tip.vue'
import PanelSection from '@/components/ui/panel/PanelSection.vue'
import AppSelect from '@/components/ui/select/AppSelect.vue'
const {
  visible: stylesVisible,
  hasStyle,
  value: styleValue,
  options: styleOptions,
  update: updateStyle
} = useSharedStylePicker('stroke')

import StrokeSettingsPopover from './StrokeSettingsPopover.vue'

const strokeCtx = useStrokeControls()
const { advancedActive } = strokeCtx
const colorProvider = useColorBindingProvider()
const okhcl = useOkHCL()
const { panels, common } = useI18n()

/** A bound variable colours the swatch, but only a solid stroke has one colour to replace. */
function displayStroke(stroke: Stroke, resolvedColor: Color | undefined): Fill {
  return stroke.type === 'SOLID' && resolvedColor ? { ...stroke, color: resolvedColor } : stroke
}

function updateStrokePaint(
  binding: BindableValueActions<Color>,
  flush: () => void,
  stroke: Stroke,
  paint: Fill,
  update: (stroke: Stroke) => void
) {
  applyPaintMutation(binding, flush, () => update(applyStrokePaint(stroke, paint)))
}

function updateStrokeColor(
  binding: BindableValueActions<Color>,
  flush: () => void,
  color: Color,
  patch: (changes: Partial<Stroke>) => void,
  commit: boolean
) {
  if (!applyPaintMutation(binding, flush, () => patch(applySolidStrokeColor(color)))) return
  if (commit) commitPaintMutation(binding)
}

const sideVisibility = ref<Record<string, boolean>>({})
watch(
  () => strokeCtx.nodes.value,
  (nodes) => {
    for (const node of nodes) sideVisibility.value[node.id] ??= node.independentStrokeWeights
  },
  { immediate: true }
)
function supportsSides(node: SceneNode | null) {
  return (
    node !== null &&
    ['FRAME', 'COMPONENT', 'INSTANCE', 'RECTANGLE', 'ROUNDED_RECTANGLE'].includes(node.type)
  )
}
function showSides(node: SceneNode | null) {
  return supportsSides(node) && node
    ? (sideVisibility.value[node.id] ?? node.independentStrokeWeights)
    : false
}
function onToggleSides(node: SceneNode | null) {
  if (node) sideVisibility.value[node.id] = !showSides(node)
}
</script>

<template>
  <PropertyListRoot
    v-slot="{ items, isMixed, activeNode, selectedNodeIds, flush, actions }"
    prop-key="strokes"
    :label="panels.stroke"
  >
    <PanelSection :label="panels.stroke" :empty="!isMixed && items.length === 0">
      <template #actions>
        <AppSelect
          v-if="stylesVisible && !hasStyle"
          :model-value="styleValue"
          :options="styleOptions"
          @update:model-value="updateStyle"
        >
          <template #trigger>
            <IconButton :label="panels.strokeStyle" data-property="stroke-style"
              ><icon-lucide-layout-grid class="size-3.5"
            /></IconButton>
          </template>
        </AppSelect>
        <StrokeSettingsPopover
          v-if="advancedActive"
          :stroke="isMixed ? undefined : items[0]"
          @patch="actions.patch(0, $event)"
        />
        <IconButton
          v-if="!isMixed && items.length > 0 && supportsSides(activeNode)"
          :label="panels.strokeSides"
          size="xs"
          class="size-[26px] shrink-0"
          :active="showSides(activeNode)"
          data-property="stroke-sides"
          @click="onToggleSides(activeNode)"
        >
          <icon-lucide-layout-grid class="size-3.5" />
        </IconButton>
        <IconButton :label="panels.addStroke" @click="actions.add(strokeCtx.defaultStroke)">
          <icon-lucide-plus class="size-3.5" />
        </IconButton>
      </template>

      <AppSelect
        v-if="stylesVisible && hasStyle"
        :model-value="styleValue"
        :options="styleOptions"
        :label="panels.strokeStyle"
        data-property="stroke-style"
        class="mb-1.5"
        @update:model-value="updateStyle"
      />

      <p v-if="isMixed" class="text-[11px] text-muted">{{ panels.mixedStrokesHelp }}</p>

      <PropertyItemRow
        v-for="(stroke, index) in items"
        :key="`${index}:${stroke.visible ? 'visible' : 'hidden'}`"
        prop-key="strokes"
        :index="index"
        :visibility-label="panels.toggleVisibility"
        :remove-label="panels.removeStroke"
      >
        <BindableValueRoot
          v-slot="binding"
          :provider="colorProvider"
          :targets="paintBindingTargets(selectedNodeIds, 'strokes', index)"
          :value="stroke.color"
          batch-label="Change stroke color"
        >
          <PaintField
            :opacity="stroke.opacity"
            :opacity-label="panels.opacity"
            @update:opacity="actions.patch(index, { opacity: $event })"
          >
            <template #preview>
              <FillPicker
                :label="panels.stroke"
                :gradient-target="
                  selectedNodeIds.length === 1 && activeNode
                    ? { nodeId: activeNode.id, property: 'strokes', index }
                    : undefined
                "
                :fill="displayStroke(stroke, binding.resolvedValue)"
                :okhcl="createStrokeOkhclAdapter(okhcl, activeNode, index)"
                @canvas-gesture="startCanvasPaintGesture(binding.actions, flush)"
                @update="
                  updateStrokePaint(binding.actions, flush, stroke, $event, (next) =>
                    actions.update(index, next)
                  )
                "
                @open-change="!$event && commitPaintMutation(binding.actions)"
                @cancel="cancelPaintMutation(binding.actions)"
              />
            </template>

            <template #value>
              <PaintValue
                v-if="stroke.type === 'SOLID'"
                :color="stroke.color"
                :resolved-color="binding.resolvedValue"
                :variable-name="binding.variable?.name ?? binding.bindingId"
                :unavailable-label="
                  binding.state === 'unresolved' ? panels.unresolvedVariable : undefined
                "
                :label="panels.stroke"
                @update="
                  updateStrokeColor(
                    binding.actions,
                    flush,
                    $event,
                    (changes) => actions.patch(index, changes),
                    true
                  )
                "
              />
            </template>

            <template #binding>
              <VariableBindingPicker
                :trigger-label="panels.applyVariable"
                :search-placeholder="common.search"
                :empty-label="panels.noVariablesFound"
                :detach-label="panels.detachVariable"
                :create-label="
                  panels.createColorVariable({ value: `#${colorToHexRaw(stroke.color)}` })
                "
                :create-name-placeholder="panels.variableName"
                :create-submit-label="panels.create"
              />
            </template>
          </PaintField>
        </BindableValueRoot>
      </PropertyItemRow>

      <div v-if="!isMixed && items.length > 0" class="mt-1 flex items-center gap-1.5">
        <AppSelect
          :label="panels.strokeType"
          :ui="{ trigger: 'w-[88px] flex-none' }"
          :model-value="strokeCtx.currentAlign(activeNode)"
          :options="strokeCtx.alignOptions"
          data-property="stroke-align"
          @update:model-value="strokeCtx.updateAlign($event as Stroke['align'], activeNode)"
        />
        <Tip :label="panels.strokeWeight">
          <VariableNumberField
            v-if="activeNode && supportsSides(activeNode) && !showSides(activeNode)"
            class="flex-1"
            icon="W"
            :aria-label="panels.strokeWeight"
            :model-value="items[0]?.weight ?? 1"
            :min="0"
            data-property="stroke-weight"
            :node-id="activeNode.id"
            :node-ids="selectedNodeIds"
            binding-path="borderTopWeight"
            :binding-paths="BORDER_WIDTH_PATHS"
            edit-properties
          />
          <NumberField
            v-else-if="activeNode && !supportsSides(activeNode)"
            icon="W"
            :aria-label="panels.strokeWeight"
            :model-value="items[0]?.weight ?? 1"
            :min="0"
            data-property="stroke-weight"
            @update:model-value="actions.patch(0, { weight: $event })"
            @commit="flush"
            @cancel="flush"
          />
        </Tip>
      </div>

      <div
        v-if="!isMixed && items.length > 0 && activeNode && showSides(activeNode)"
        class="mt-1.5 grid grid-cols-2 gap-1.5"
      >
        <VariableNumberField
          v-for="(path, index) in BORDER_WIDTH_PATHS"
          :key="path"
          :label="['T', 'R', 'B', 'L'][index]"
          :model-value="0"
          :min="0"
          :data-property="`stroke-${strokeCtx.borderSides[index]}-weight`"
          :node-id="activeNode.id"
          :node-ids="selectedNodeIds"
          :binding-path="path"
          edit-properties
        />
      </div>
    </PanelSection>
  </PropertyListRoot>
</template>
