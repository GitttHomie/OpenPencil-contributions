<script setup lang="ts">
import { computed } from 'vue'

import { TypographyControlsRoot, useI18n } from '@open-pencil/vue'

import { typographyFontLoader } from '@/app/editor/fonts/selection'
import FontPicker from '@/components/font-picker/FontPicker.vue'
import FontSettingsPopover from '@/components/font-settings/FontSettingsPopover.vue'
import NumberField from '@/components/inputs/NumberField.vue'
import SharedStyleField from '@/components/properties/shared-style/SharedStyleField.vue'
import LineHeightField from '@/components/properties/typography/LineHeightField.vue'
import VariableNumberField from '@/components/properties/VariableNumberField.vue'
import Tip from '@/components/ui/overlay/Tip.vue'
import PanelFieldGroup from '@/components/ui/panel/PanelFieldGroup.vue'
import PanelGrid from '@/components/ui/panel/PanelGrid.vue'
import PanelSection from '@/components/ui/panel/PanelSection.vue'
import AppSelect from '@/components/ui/select/AppSelect.vue'
import AppSwitch from '@/components/ui/toggle/AppSwitch.vue'

import TextAlignmentFields from './typography/TextAlignmentFields.vue'
import TextFormattingField from './typography/TextFormattingField.vue'

const { panels } = useI18n()
const textCaseOptions = computed(() => [
  { value: 'ORIGINAL', label: panels.value.textCaseOriginal },
  { value: 'UPPER', label: panels.value.textCaseUpper },
  { value: 'LOWER', label: panels.value.textCaseLower },
  { value: 'TITLE', label: panels.value.textCaseTitle }
])
const truncationOptions = computed(() => [
  { value: 'DISABLED', label: panels.value.truncationDisabled },
  { value: 'ENDING', label: panels.value.truncationEnding }
])
const commonFeatures = computed(() => [
  { tag: 'LIGA', label: panels.value.standardLigatures },
  { tag: 'CALT', label: panels.value.contextualAlternates },
  { tag: 'KERN', label: panels.value.kerning }
])

function featureEnabled(features: Array<{ tag: string; enabled: boolean }>, tag: string) {
  return features.find((feature) => feature.tag === tag)?.enabled ?? true
}
</script>

<template>
  <TypographyControlsRoot v-slot="ctx" :font-loader="typographyFontLoader">
    <PanelSection v-if="ctx.node.value" :label="panels.typography">
      <SharedStyleField kind="text" :label="panels.textStyle" />

      <div class="mb-field-group flex min-w-0 items-center gap-1.5">
        <FontPicker
          class="min-w-0 flex-1"
          :model-value="ctx.node.value.fontFamily"
          :label="panels.fontFamily"
          @select="ctx.actions.setFamily"
        />
        <FontSettingsPopover />
        <Tip
          v-if="ctx.hasMissingFonts.value"
          :label="
            'Missing font' +
            (ctx.missingFonts.value.length > 1 ? 's' : '') +
            ': ' +
            ctx.missingFonts.value.join(', ')
          "
        >
          <icon-lucide-alert-triangle
            role="img"
            :aria-label="
              'Missing font' +
              (ctx.missingFonts.value.length > 1 ? 's' : '') +
              ': ' +
              ctx.missingFonts.value.join(', ')
            "
            class="size-3.5 shrink-0 text-[var(--color-warning-action)]"
          />
        </Tip>
      </div>

      <PanelGrid :columns="2" class="mb-field-group">
        <PanelFieldGroup :label="panels.fontWeight">
          <AppSelect
            :label="panels.fontWeight"
            :model-value="ctx.node.value.fontWeight"
            :options="ctx.weights"
            :disabled="
              ctx.weights.length <= 1 &&
              ctx.weights.every((weight) => weight.value === ctx.node.value?.fontWeight)
            "
            :placeholder="String(ctx.node.value.fontWeight)"
            @update:model-value="ctx.actions.setWeight(+$event)"
          />
        </PanelFieldGroup>
        <PanelFieldGroup :label="panels.fontSize">
          <VariableNumberField
            :model-value="ctx.node.value.fontSize"
            :aria-label="panels.fontSize"
            :min="1"
            :max="1000"
            :node-id="ctx.node.value.id"
            binding-path="fontSize"
            @update:model-value="ctx.actions.updateProp('fontSize', $event)"
            @commit="(v: number, p: number) => ctx.actions.commitProp('fontSize', v, p)"
          />
        </PanelFieldGroup>
      </PanelGrid>

      <PanelGrid :columns="2" class="mb-field-group">
        <PanelFieldGroup :label="panels.lineHeight">
          <LineHeightField
            :node="ctx.node.value"
            @update="ctx.actions.updateProp('lineHeight', $event)"
            @commit="(v, p) => ctx.actions.commitProp('lineHeight', v, p)"
          />
        </PanelFieldGroup>
        <PanelFieldGroup :label="panels.letterSpacing">
          <VariableNumberField
            suffix="px"
            :model-value="ctx.node.value.letterSpacing"
            :aria-label="panels.letterSpacing"
            :node-id="ctx.node.value.id"
            binding-path="letterSpacing"
            @update:model-value="ctx.actions.updateProp('letterSpacing', $event)"
            @commit="(v: number, p: number) => ctx.actions.commitProp('letterSpacing', v, p)"
          >
            <template #icon>
              <icon-lucide-a-large-small class="size-3" />
            </template>
          </VariableNumberField>
        </PanelFieldGroup>
      </PanelGrid>

      <div class="border-t border-border pt-field-group">
        <PanelFieldGroup :label="panels.direction" class="mb-field-group">
          <AppSelect
            :label="panels.direction"
            :model-value="ctx.node.value.textDirection"
            :options="[
              { value: 'AUTO', label: panels.auto },
              { value: 'LTR', label: 'LTR' },
              { value: 'RTL', label: 'RTL' }
            ]"
            @update:model-value="ctx.actions.setDirection($event as 'AUTO' | 'LTR' | 'RTL')"
          />
        </PanelFieldGroup>

        <TextAlignmentFields
          :horizontal="ctx.node.value.textAlignHorizontal"
          :vertical="ctx.node.value.textAlignVertical"
          @horizontal="ctx.actions.align"
          @vertical="ctx.actions.setVerticalAlign"
        />
      </div>

      <div class="border-t border-border pt-field-group">
        <TextFormattingField
          :active="ctx.activeFormatting.value"
          :can-toggle-bold="ctx.canToggleBold"
          :can-toggle-italic="ctx.canToggleItalic"
          @bold="ctx.actions.toggleBold"
          @italic="ctx.actions.toggleItalic"
          @decoration="ctx.actions.toggleDecoration"
        />

        <PanelGrid :columns="2" class="mb-field-group">
          <PanelFieldGroup :label="panels.textCase">
            <AppSelect
              :label="panels.textCase"
              :model-value="ctx.node.value.textCase"
              :options="textCaseOptions"
              @update:model-value="
                ctx.actions.setTextCase($event as 'ORIGINAL' | 'UPPER' | 'LOWER' | 'TITLE')
              "
            />
          </PanelFieldGroup>
          <PanelFieldGroup :label="panels.truncation">
            <AppSelect
              :label="panels.truncation"
              :model-value="ctx.node.value.textTruncation"
              :options="truncationOptions"
              @update:model-value="ctx.actions.setTruncation($event as 'DISABLED' | 'ENDING')"
            />
          </PanelFieldGroup>
        </PanelGrid>

        <PanelFieldGroup
          v-if="ctx.node.value.textTruncation === 'ENDING'"
          :label="panels.maxLines"
          class="mb-field-group"
        >
          <NumberField
            :model-value="ctx.node.value.maxLines ?? 1"
            :aria-label="panels.maxLines"
            :min="1"
            :step="1"
            data-property="max-lines"
            @update:model-value="
              ctx.actions.updateProp('maxLines', Math.max(1, Math.round($event)))
            "
            @commit="
              (value: number, previous: number) =>
                ctx.actions.commitProp('maxLines', value, previous)
            "
          />
        </PanelFieldGroup>
      </div>

      <div class="grid gap-2.5 border-t border-border pt-field-group">
        <label
          v-for="feature in commonFeatures"
          :key="feature.tag"
          class="flex items-center justify-between gap-1.5 text-[11px] text-muted"
        >
          <span>{{ feature.label }}</span>
          <AppSwitch
            :model-value="featureEnabled(ctx.node.value.fontFeatures, feature.tag)"
            :label="feature.label"
            :data-property="`font-feature-${feature.tag.toLowerCase()}`"
            @update:model-value="ctx.actions.setFontFeature(feature.tag, $event)"
          />
        </label>
      </div>
    </PanelSection>
  </TypographyControlsRoot>
</template>
