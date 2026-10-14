<script setup lang="ts">
import { computed, ref } from 'vue'

import { getNodeEditCapability } from '@open-pencil/core/editor'
import { isInComponent, readIcon } from '@open-pencil/scene-graph'
import {
  useI18n,
  useSelectionState,
  useEditorCommands,
  useEditorEvent,
  useSceneComputed
} from '@open-pencil/vue'

import { useEditorStore } from '@/app/editor/active-store'
import { sceneNodeIcon } from '@/app/editor/icons'
import { openVariablesDialog } from '@/app/editor/tokens/dialog'
import { openLibraryReview, useLibraryService } from '@/app/libraries'
import IconButton from '@/components/ui/button/IconButton.vue'
import Tip from '@/components/ui/overlay/Tip.vue'
import PanelHeader from '@/components/ui/panel/PanelHeader.vue'

import AppearanceSection from './properties/AppearanceSection.vue'
import BooleanOperationsControl from './properties/BooleanOperationsControl.vue'
import BehaviourPanel from './properties/component-properties/behaviour/BehaviourPanel.vue'
import ComponentAuthoringSection from './properties/component-properties/ComponentAuthoringSection.vue'
import ComponentPropertiesSection from './properties/component-properties/ComponentPropertiesSection.vue'
import InstanceUpdateAction from './properties/component-properties/instance-update/InstanceUpdateAction.vue'
import SlotAuthoringSection from './properties/component-properties/slot/SlotAuthoringSection.vue'
import type { ComponentPropertyFocusRequest } from './properties/component-properties/usePropertyValueFocus'
import VariantAuthoringSection from './properties/component-properties/variant/VariantAuthoringSection.vue'
import ConstraintsSection from './properties/constraints/ConstraintsSection.vue'
import EffectsSection from './properties/EffectsSection.vue'
import ExportSection from './properties/ExportSection.vue'
import FillSection from './properties/FillSection.vue'
import FramePresetSelect from './properties/frame-presets/FramePresetSelect.vue'
import FramePresetsSection from './properties/frame-presets/FramePresetsSection.vue'
import IconSection from './properties/IconSection.vue'
import LayerTypeMenu from './properties/LayerTypeMenu.vue'
import LayoutGridSection from './properties/layout/guides/LayoutGridSection.vue'
import LayoutSection from './properties/layout/LayoutSection.vue'
import MaskSection from './properties/MaskSection.vue'
import PageSection from './properties/PageSection.vue'
import RetainedPanel from './properties/panel/RetainedPanel.vue'
import PositionSection from './properties/PositionSection.vue'
import SelectionColorsSection from './properties/selection/SelectionColorsSection.vue'
import StrokeSection from './properties/stroke/StrokeSection.vue'
import TypographySection from './properties/TypographySection.vue'
import VariablesSection from './properties/VariablesSection.vue'

const propertyFocus = ref<ComponentPropertyFocusRequest | null>(null)
let propertyFocusRequest = 0
useEditorEvent('selection:changed', () => {
  propertyFocus.value = null
})
useEditorEvent('component-property:edit-requested', (target) => {
  propertyFocus.value = { ...target, request: ++propertyFocusRequest }
})
const store = useEditorStore()
const libraryService = useLibraryService()
const activeTool = computed(() => store.state.activeTool)
const { selectedNode: node, selectedCount: multiCount } = useSelectionState()
const { getCommand } = useEditorCommands()
const createComponent = getCommand('selection.createComponent')
const goToMainComponent = getCommand('selection.goToMainComponent')
const detachInstance = getCommand('selection.detachInstance')
const isComponentType = useSceneComputed(() =>
  node.value ? isInComponent(store.graph, node.value.id) : false
)
const selectedIcon = computed(() => (node.value ? sceneNodeIcon(node.value) : undefined))
const allText = useSceneComputed(() => {
  const nodes = store.getSelectedNodes()
  return nodes.length > 0 && nodes.every((node) => node.type === 'TEXT')
})
const canAddVariant = computed(
  () => !!node.value && getNodeEditCapability(store.graph, node.value.id).editable
)
function openSelectedInstanceReview() {
  const instance = node.value
  if (instance?.type !== 'INSTANCE' || !instance.componentId) return
  const component = store.graph.getNode(instance.componentId)
  const identity = component?.librarySource?.identity
  if (!identity) return
  openLibraryReview({
    libraryId: identity.libraryId,
    assetKey: identity.assetKey,
    instanceIds: [instance.id],
    initialInstanceId: instance.id
  })
}
const LAYOUT_GUIDE_TYPES = new Set(['FRAME', 'COMPONENT', 'COMPONENT_SET', 'INSTANCE'])
// Figma offers layout guides while every selected layer is a frame.
const supportsLayoutGuides = useSceneComputed(() => {
  const nodes = store.getSelectedNodes()
  return nodes.length > 0 && nodes.every((selected) => LAYOUT_GUIDE_TYPES.has(selected.type))
})
const { panels } = useI18n()
</script>

<template>
  <!-- Frame tool presets replace selection properties, matching Figma. -->
  <div
    v-if="activeTool === 'FRAME'"
    class="scrollbar-thin flex-1 overflow-x-hidden overflow-y-auto pb-4"
  >
    <FramePresetsSection />
  </div>

  <!-- Multi-select summary -->
  <div
    v-else-if="multiCount > 1"
    data-test-id="design-panel-multi"
    class="scrollbar-thin flex-1 overflow-x-hidden overflow-y-auto pb-4"
  >
    <PanelHeader>
      <template #icon>
        <icon-lucide-layers-3 class="size-3.5" aria-hidden="true" />
      </template>
      <span role="heading" aria-level="2">
        {{ panels.selectedCount({ count: String(multiCount) }) }}
      </span>
      <template #actions>
        <BooleanOperationsControl />
      </template>
    </PanelHeader>
    <ComponentPropertiesSection />
    <PositionSection :show-size="false" />
    <ConstraintsSection />
    <LayoutSection />
    <AppearanceSection />
    <TypographySection v-if="allText" />
    <FillSection />
    <StrokeSection />
    <EffectsSection />
    <SelectionColorsSection />
    <LayoutGridSection v-if="supportsLayoutGuides" />
    <ExportSection />
  </div>

  <!-- Single selection: retain one paused subtree while frame presets are shown. -->
  <RetainedPanel :active="activeTool !== 'FRAME' && multiCount === 1 && !!node">
    <div
      v-if="node"
      data-test-id="design-panel-single"
      class="scrollbar-thin flex-1 overflow-x-hidden overflow-y-auto pb-4"
    >
      <PanelHeader :component="isComponentType">
        <template #icon>
          <LayerTypeMenu
            v-if="node.type === 'FRAME' || node.type === 'GROUP' || node.type === 'SECTION'"
            :node="node"
            :icon="selectedIcon"
          />
          <Tip v-else :label="node.type">
            <span role="img" :aria-label="node.type" class="contents">
              <component :is="selectedIcon" class="size-3.5" />
            </span>
          </Tip>
        </template>
        <span role="heading" aria-level="2" class="min-w-0">
          {{ node.name }}
        </span>
        <template #actions>
          <IconButton
            v-if="node.type === 'COMPONENT' || node.type === 'COMPONENT_SET'"
            :label="panels.addVariant"
            data-test-id="add-variant"
            :disabled="!canAddVariant"
            @click="store.addVariant(node.id)"
          >
            <icon-lucide-diamond-plus class="size-3.5" />
          </IconButton>
          <IconButton
            v-if="node.type === 'FRAME'"
            :label="createComponent.label"
            :disabled="!createComponent.enabled.value"
            @click="createComponent.run()"
          >
            <icon-lucide-diamond-plus class="size-3.5" />
          </IconButton>
          <InstanceUpdateAction
            v-if="node.type === 'INSTANCE'"
            :node="node"
            :editor="store"
            :service="libraryService"
            @review="openSelectedInstanceReview"
          />
          <template v-if="node.type === 'INSTANCE'">
            <IconButton
              :label="goToMainComponent.label"
              :disabled="!goToMainComponent.enabled.value"
              @click="goToMainComponent.run()"
            >
              <icon-lucide-component class="size-3.5 text-component" />
            </IconButton>
            <IconButton
              :label="detachInstance.label"
              :disabled="!detachInstance.enabled.value"
              @click="detachInstance.run()"
            >
              <icon-lucide-unlink class="size-3.5" />
            </IconButton>
          </template>
        </template>
      </PanelHeader>

      <ComponentPropertiesSection v-if="node.type === 'INSTANCE'" :focus-request="propertyFocus" />
      <VariantAuthoringSection v-if="node.type === 'COMPONENT_SET' || node.type === 'COMPONENT'" />
      <ComponentAuthoringSection :focus-request="propertyFocus" />

      <SlotAuthoringSection />
      <BehaviourPanel v-if="node.type === 'COMPONENT' || node.type === 'COMPONENT_SET'" />

      <!-- Presets size artboards; an icon is a glyph. -->
      <FramePresetSelect v-if="node.type === 'FRAME' && !readIcon(node)" />

      <IconSection />
      <PositionSection />
      <ConstraintsSection />
      <LayoutSection />
      <AppearanceSection />
      <MaskSection />
      <TypographySection v-if="node.type === 'TEXT'" />
      <FillSection />
      <StrokeSection />
      <EffectsSection />
      <SelectionColorsSection />
      <LayoutGridSection v-if="supportsLayoutGuides" />

      <ExportSection />
    </div>
  </RetainedPanel>

  <div
    v-if="activeTool !== 'FRAME' && multiCount <= 1 && !node"
    data-test-id="design-panel-empty"
    class="scrollbar-thin flex-1 overflow-x-hidden overflow-y-auto pb-4"
  >
    <PageSection />
    <VariablesSection @open-dialog="openVariablesDialog(store)" />
    <ExportSection />
  </div>
</template>
