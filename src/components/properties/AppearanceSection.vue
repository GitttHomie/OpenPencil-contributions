<script setup lang="ts">
import type { BlendMode } from '@open-pencil/scene-graph'
import { POINT_COUNT_RANGE } from '@open-pencil/scene-graph/polygon'
import {
  AppearanceControlsRoot,
  CORNER_RADIUS_PATHS,
  MIXED,
  useI18n,
  useVariableModes
} from '@open-pencil/vue'

import NumberField from '@/components/inputs/NumberField.vue'
import { useBlendModeGroups } from '@/components/properties/blend-mode/use'
import MaskAction from '@/components/properties/MaskAction.vue'
import VariableNumberField from '@/components/properties/VariableNumberField.vue'
import VisibilityField from '@/components/properties/visibility/VisibilityField.vue'
import IconButton from '@/components/ui/button/IconButton.vue'
import PanelFieldGroup from '@/components/ui/panel/PanelFieldGroup.vue'
import PanelGrid from '@/components/ui/panel/PanelGrid.vue'
import PanelSection from '@/components/ui/panel/PanelSection.vue'
import AppSelect from '@/components/ui/select/AppSelect.vue'

import VariableModeMenu from './variable-modes/VariableModeMenu.vue'
import VariableModeRows from './variable-modes/VariableModeRows.vue'

const { panels } = useI18n()
const variableModes = useVariableModes()
type BlendModeSelectValue = BlendMode | 'MIXED'

const baseBlendModeGroups = useBlendModeGroups(true)

function blendModeGroups(value: BlendMode | typeof MIXED) {
  return value === MIXED
    ? [
        { options: [{ value: 'MIXED' as const, label: panels.value.mixed }] },
        ...baseBlendModeGroups.value
      ]
    : baseBlendModeGroups.value
}
</script>

<template>
  <AppearanceControlsRoot
    v-slot="{
      nodes,
      active,
      hasCornerRadius,
      cornerRadiusDisabled,
      splitsCorners,
      hasPointCount,
      hasStarRatio,
      pointCount,
      starRatioPercent,
      showIndependentCorners,
      cornerRadiusValue,
      cornerSmoothingPercent,
      opacityPercent,
      blendModeValue,
      visibilityState,
      visibilityLinked,
      visibilityPropertyNames,
      actions
    }"
  >
    <PanelSection v-if="active" :label="panels.appearance">
      <template #actions>
        <MaskAction />
        <VariableModeMenu :choices="variableModes.choices.value" @set="variableModes.setMode" />
      </template>

      <VisibilityField
        :nodes="nodes"
        :state="visibilityState"
        :linked="visibilityLinked"
        :property-names="visibilityPropertyNames"
        class="mb-field-group"
        @toggle="actions.toggleVisibility"
      />
      <PanelGrid :columns="2">
        <PanelFieldGroup :label="panels.blendMode">
          <AppSelect
            :model-value="blendModeValue === MIXED ? 'MIXED' : blendModeValue"
            class="w-full"
            :label="panels.blendMode"
            :groups="blendModeGroups(blendModeValue)"
            @update:model-value="
              (value: BlendModeSelectValue) => value !== 'MIXED' && actions.setBlendMode(value)
            "
          />
        </PanelFieldGroup>

        <PanelFieldGroup :label="panels.opacity">
          <VariableNumberField
            v-if="nodes[0]"
            suffix="%"
            :aria-label="panels.opacity"
            :model-value="opacityPercent"
            :min="0"
            :max="100"
            :node-id="nodes[0].id"
            :node-ids="nodes.map((node) => node.id)"
            :display-scale="100"
            binding-path="opacity"
            @update:model-value="actions.updateProp('opacity', $event / 100)"
            @commit="(v: number, p: number) => actions.commitProp('opacity', v / 100, p / 100)"
          >
            <template #icon>
              <icon-lucide-blend class="size-3" />
            </template>
          </VariableNumberField>
        </PanelFieldGroup>
      </PanelGrid>

      <PanelGrid
        v-if="hasCornerRadius && !showIndependentCorners"
        :columns="2"
        class="mt-field-group"
      >
        <PanelFieldGroup :label="panels.radius">
          <VariableNumberField
            v-if="nodes[0]"
            :aria-label="panels.radius"
            :model-value="cornerRadiusValue"
            :min="0"
            :node-id="nodes[0].id"
            :node-ids="nodes.map((node) => node.id)"
            binding-path="cornerRadius"
            :binding-paths="CORNER_RADIUS_PATHS"
            edit-properties
          >
            <template #icon><icon-lucide-square-round-corner class="size-3" /></template>
          </VariableNumberField>
        </PanelFieldGroup>
        <div v-if="splitsCorners" class="flex h-6 items-center justify-end">
          <IconButton
            :label="panels.independentCornerRadii"
            size="xs"
            :active="showIndependentCorners"
            :disabled="cornerRadiusDisabled"
            @click="actions.toggleIndependentCorners"
          >
            <icon-lucide-square-round-corner class="size-3" />
          </IconButton>
        </div>
      </PanelGrid>

      <PanelGrid
        v-else-if="hasCornerRadius && nodes[0]"
        :columns="2"
        class="mt-1.5 [&>[data-slot=actions]]:self-start"
        data-corner-grid
      >
        <VariableNumberField
          v-for="(path, index) in CORNER_RADIUS_PATHS"
          :key="path"
          :label="['TL', 'TR', 'BR', 'BL'][index]"
          :model-value="0"
          :min="0"
          :node-id="nodes[0].id"
          :node-ids="nodes.map((node) => node.id)"
          :binding-path="path"
          edit-properties
        />
        <template #actions>
          <IconButton
            :label="panels.independentCornerRadii"
            size="xs"
            active
            @click="actions.toggleIndependentCorners"
          >
            <icon-lucide-square-round-corner class="size-3" />
          </IconButton>
        </template>
      </PanelGrid>

      <PanelGrid v-if="hasPointCount" :columns="2" class="mt-field-group">
        <PanelFieldGroup :label="panels.pointCount">
          <NumberField
            :model-value="pointCount"
            :min="POINT_COUNT_RANGE.min"
            :max="POINT_COUNT_RANGE.max"
            :aria-label="panels.pointCount"
            data-property="pointCount"
            @update:model-value="actions.updateProp('pointCount', Math.round($event))"
            @commit="(v: number, p: number) => actions.commitProp('pointCount', Math.round(v), p)"
          >
            <template #icon>
              <icon-lucide-asterisk class="size-3" />
            </template>
          </NumberField>
        </PanelFieldGroup>
        <PanelFieldGroup v-if="hasStarRatio" :label="panels.starRatio">
          <NumberField
            suffix="%"
            :model-value="starRatioPercent"
            :min="0"
            :max="100"
            :step="0.1"
            :aria-label="panels.starRatio"
            data-property="starInnerRadius"
            @update:model-value="actions.updateProp('starInnerRadius', $event / 100)"
            @commit="
              (v: number, p: number) => actions.commitProp('starInnerRadius', v / 100, p / 100)
            "
          >
            <template #icon>
              <icon-lucide-star class="size-3" />
            </template>
          </NumberField>
        </PanelFieldGroup>
      </PanelGrid>

      <PanelGrid
        v-if="hasCornerRadius && !cornerRadiusDisabled"
        :columns="2"
        class="mt-field-group"
      >
        <PanelFieldGroup :label="panels.cornerSmoothing">
          <VariableNumberField
            v-if="nodes[0]"
            :node-id="nodes[0].id"
            :node-ids="nodes.map((node) => node.id)"
            binding-path="cornerSmoothing"
            :display-scale="100"
            suffix="%"
            :model-value="cornerSmoothingPercent"
            :min="0"
            :max="100"
            :aria-label="panels.cornerSmoothing"
            data-property="corner-smoothing"
            @update:model-value="actions.updateCornerProp('cornerSmoothing', $event / 100)"
            @commit="
              (v: number, p: number) =>
                actions.commitCornerProp('cornerSmoothing', v / 100, p / 100)
            "
          >
            <template #icon>
              <icon-lucide-squircle class="size-3" />
            </template>
          </VariableNumberField>
        </PanelFieldGroup>
      </PanelGrid>

      <VariableModeRows :choices="variableModes.applied.value" @set="variableModes.setMode" />
    </PanelSection>
  </AppearanceControlsRoot>
</template>
