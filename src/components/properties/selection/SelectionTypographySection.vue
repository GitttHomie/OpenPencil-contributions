<script setup lang="ts">
import { computed } from 'vue'

import type { SceneNode } from '@open-pencil/scene-graph'
import { MIXED, useI18n, useTypography } from '@open-pencil/vue'

import { typographyFontLoader } from '@/app/editor/fonts/selection'
import FontPicker from '@/components/font-picker/FontPicker.vue'
import FontSettingsPopover from '@/components/font-settings/FontSettingsPopover.vue'
import NumberField from '@/components/inputs/NumberField.vue'
import SharedStyleField from '@/components/properties/shared-style/SharedStyleField.vue'
import LineHeightField from '@/components/properties/typography/LineHeightField.vue'
import VariableNumberField from '@/components/properties/VariableNumberField.vue'
import PanelFieldGroup from '@/components/ui/panel/PanelFieldGroup.vue'
import PanelGrid from '@/components/ui/panel/PanelGrid.vue'
import PanelSection from '@/components/ui/panel/PanelSection.vue'
import AppSwitch from '@/components/ui/toggle/AppSwitch.vue'

import TextAlignmentFields from '../typography/TextAlignmentFields.vue'
import TextFormattingField from '../typography/TextFormattingField.vue'
import SelectionSelectField from './SelectionSelectField.vue'

const { panels } = useI18n()
const typography = useTypography({ fontLoader: typographyFontLoader })
const { nodes, merged } = typography
function family() {
  const value = merged('fontFamily')
  return typeof value === 'string' ? value : ''
}
const activeFormatting = computed(() => {
  const active: string[] = []
  if (nodes.value.every((node) => node.fontWeight >= 700)) active.push('bold')
  if (nodes.value.every((node) => node.italic)) active.push('italic')
  if (nodes.value.every((node) => node.textDecoration === 'UNDERLINE')) active.push('underline')
  if (nodes.value.every((node) => node.textDecoration === 'STRIKETHROUGH'))
    active.push('strikethrough')
  return active
})
function featureValue(tag: string) {
  const values = nodes.value.map(
    (node) => node.fontFeatures.find((feature) => feature.tag === tag)?.enabled ?? true
  )
  return values.every((value) => value === values[0]) ? values[0] : MIXED
}
</script>

<template>
  <PanelSection v-if="nodes.length > 1" :label="panels.typography">
    <SharedStyleField kind="text" :label="panels.textStyle" />
    <div class="mb-field-group flex min-w-0 items-center gap-1.5">
      <FontPicker
        class="min-w-0 flex-1"
        :model-value="family()"
        :label="panels.fontFamily"
        :placeholder="panels.mixed"
        @select="typography.setFamily"
      />
      <FontSettingsPopover />
    </div>
    <PanelGrid :columns="2" class="mb-field-group">
      <SelectionSelectField
        :label="panels.fontWeight"
        :value="merged('fontWeight')"
        :options="typography.weights"
        @change="typography.setWeight"
      />
      <PanelFieldGroup :label="panels.fontSize">
        <VariableNumberField
          :model-value="merged('fontSize')"
          :aria-label="panels.fontSize"
          :min="1"
          :max="1000"
          :node-id="nodes[0]?.id ?? ''"
          :node-ids="nodes.map((node) => node.id)"
          binding-path="fontSize"
          edit-properties
        />
      </PanelFieldGroup>
    </PanelGrid>
    <PanelGrid :columns="2" class="mb-field-group">
      <PanelFieldGroup :label="panels.lineHeight">
        <LineHeightField v-if="nodes[0]" :node="nodes[0]" :nodes="nodes" />
      </PanelFieldGroup>
      <PanelFieldGroup :label="panels.letterSpacing">
        <VariableNumberField
          suffix="px"
          :model-value="merged('letterSpacing')"
          :aria-label="panels.letterSpacing"
          :node-id="nodes[0]?.id ?? ''"
          :node-ids="nodes.map((node) => node.id)"
          binding-path="letterSpacing"
          edit-properties
        >
          <template #icon><icon-lucide-a-large-small class="size-3" /></template>
        </VariableNumberField>
      </PanelFieldGroup>
    </PanelGrid>
    <div class="border-t border-border pt-field-group">
      <SelectionSelectField
        class="mb-field-group"
        :label="panels.direction"
        :value="merged('textDirection')"
        :options="[
          { value: 'AUTO', label: panels.auto },
          { value: 'LTR', label: 'LTR' },
          { value: 'RTL', label: 'RTL' }
        ]"
        @change="typography.setDirection($event as SceneNode['textDirection'])"
      />
      <TextAlignmentFields
        :horizontal="merged('textAlignHorizontal')"
        :vertical="merged('textAlignVertical')"
        @horizontal="typography.setAlign"
        @vertical="typography.setVerticalAlign"
      />
    </div>
    <div class="border-t border-border pt-field-group">
      <TextFormattingField
        :active="activeFormatting"
        :can-toggle-bold="typography.canToggleBold"
        :can-toggle-italic="typography.canToggleItalic"
        @bold="typography.toggleBold"
        @italic="typography.toggleItalic"
        @decoration="typography.toggleDecoration"
      />
      <PanelGrid :columns="2" class="mb-field-group">
        <SelectionSelectField
          :label="panels.textCase"
          :value="merged('textCase')"
          :options="[
            { value: 'ORIGINAL', label: panels.textCaseOriginal },
            { value: 'UPPER', label: panels.textCaseUpper },
            { value: 'LOWER', label: panels.textCaseLower },
            { value: 'TITLE', label: panels.textCaseTitle }
          ]"
          @change="typography.setTextCase($event as SceneNode['textCase'])"
        />
        <SelectionSelectField
          :label="panels.truncation"
          :value="merged('textTruncation')"
          :options="[
            { value: 'DISABLED', label: panels.truncationDisabled },
            { value: 'ENDING', label: panels.truncationEnding }
          ]"
          @change="typography.setTruncation($event as SceneNode['textTruncation'])"
        />
      </PanelGrid>
      <PanelFieldGroup
        v-if="nodes.every((node) => node.textTruncation === 'ENDING')"
        :label="panels.maxLines"
        class="mb-field-group"
      >
        <NumberField
          :aria-label="panels.maxLines"
          :model-value="merged('maxLines') ?? 1"
          :min="1"
          :step="1"
          @update:model-value="typography.updateProp('maxLines', Math.max(1, Math.round($event)))"
          @commit="(value, previous) => typography.commitProp('maxLines', value, previous)"
          @cancel="typography.cancelProp"
        />
      </PanelFieldGroup>
    </div>
    <div class="grid gap-2.5 border-t border-border pt-field-group">
      <label
        v-for="feature in [
          { tag: 'LIGA', label: panels.standardLigatures },
          { tag: 'CALT', label: panels.contextualAlternates },
          { tag: 'KERN', label: panels.kerning }
        ]"
        :key="feature.tag"
        class="flex items-center justify-between gap-1.5 text-[11px] text-muted"
      >
        {{ feature.label }}
        <AppSwitch
          :label="feature.label"
          :model-value="featureValue(feature.tag) === true"
          :state="featureValue(feature.tag) === MIXED ? 'mixed' : 'idle'"
          @update:model-value="typography.setFontFeature(feature.tag, $event)"
        />
      </label>
    </div>
  </PanelSection>
</template>
