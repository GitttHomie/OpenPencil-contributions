<script setup lang="ts">
import type { BlendMode } from '@open-pencil/scene-graph'
import { AppearanceControlsRoot, CORNER_RADIUS_PATHS, MIXED, useI18n } from '@open-pencil/vue'

import NumberField from '@/components/inputs/NumberField.vue'
import { useBlendModeOptions } from '@/components/properties/blend-mode/use'
import MaskAction from '@/components/properties/MaskAction.vue'
import VariableNumberField from '@/components/properties/VariableNumberField.vue'
import IconButton from '@/components/ui/button/IconButton.vue'
import Tip from '@/components/ui/overlay/Tip.vue'
import PanelFieldGroup from '@/components/ui/panel/PanelFieldGroup.vue'
import PanelGrid from '@/components/ui/panel/PanelGrid.vue'
import PanelSection from '@/components/ui/panel/PanelSection.vue'
import AppSelect from '@/components/ui/select/AppSelect.vue'

const { panels } = useI18n()
type BlendModeSelectValue = BlendMode | 'MIXED'

const baseBlendModeOptions = useBlendModeOptions(true)

function blendModeOptions(value: BlendMode | typeof MIXED) {
  return value === MIXED
    ? [{ value: 'MIXED' as const, label: panels.value.mixed }, ...baseBlendModeOptions.value]
    : baseBlendModeOptions.value
}
</script>

<template>
  <AppearanceControlsRoot
    v-slot="{
      node,
      nodes,
      isMulti,
      active,
      hasCornerRadius,
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
        <Tip
          v-if="visibilityLinked"
          :label="`${panels.layerVisibility}: ${visibilityPropertyNames.join(', ')}`"
        >
          <span
            role="img"
            tabindex="0"
            :aria-label="`${panels.layerVisibility}: ${visibilityPropertyNames.join(', ')}`"
            class="inline-flex size-6 items-center justify-center text-accent"
          >
            <icon-lucide-link class="size-3.5" />
          </span>
        </Tip>
        <IconButton
          :label="panels.toggleVisibility"
          :active="visibilityState === 'hidden'"
          :disabled="visibilityLinked"
          @click="actions.toggleVisibility"
        >
          <icon-lucide-eye v-if="visibilityState === 'visible'" class="size-3.5" />
          <icon-lucide-eye-off v-else-if="visibilityState === 'hidden'" class="size-3.5" />
          <icon-lucide-eye v-else class="size-3.5 opacity-50" />
        </IconButton>
      </template>

      <PanelGrid :columns="2">
        <PanelFieldGroup :label="panels.blendMode">
          <AppSelect
            :model-value="blendModeValue === MIXED ? 'MIXED' : blendModeValue"
            class="w-full"
            :label="panels.blendMode"
            :options="blendModeOptions(blendModeValue)"
            @update:model-value="
              (value: BlendModeSelectValue) => value !== 'MIXED' && actions.setBlendMode(value)
            "
          />
        </PanelFieldGroup>

        <PanelFieldGroup :label="panels.opacity">
          <VariableNumberField
            v-if="node && !isMulti"
            suffix="%"
            :aria-label="panels.opacity"
            :model-value="opacityPercent"
            :min="0"
            :max="100"
            :node-id="node.id"
            binding-path="opacity"
            @update:model-value="actions.updateProp('opacity', $event / 100)"
            @commit="(v: number, p: number) => actions.commitProp('opacity', v / 100, p / 100)"
          >
            <template #icon>
              <icon-lucide-blend class="size-3" />
            </template>
          </VariableNumberField>
          <NumberField
            v-else
            suffix="%"
            data-property="opacity"
            :aria-label="panels.opacity"
            :model-value="opacityPercent"
            :min="0"
            :max="100"
            @update:model-value="actions.updateProp('opacity', $event / 100)"
            @commit="(v: number, p: number) => actions.commitProp('opacity', v / 100, p / 100)"
          >
            <template #icon>
              <icon-lucide-blend class="size-3" />
            </template>
          </NumberField>
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
        <div class="flex h-6 items-center justify-end">
          <IconButton
            :label="panels.independentCornerRadii"
            size="xs"
            :active="showIndependentCorners"
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

      <PanelGrid v-if="hasCornerRadius" :columns="2" class="mt-field-group">
        <PanelFieldGroup :label="panels.cornerSmoothing">
          <NumberField
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
          </NumberField>
        </PanelFieldGroup>
      </PanelGrid>
    </PanelSection>
  </AppearanceControlsRoot>
</template>
