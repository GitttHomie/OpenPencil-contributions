<script setup lang="ts">
import { LayoutControlsRoot, useI18n, useSelectionLayout } from '@open-pencil/vue'

import ClipContentControl from '@/components/properties/layout/ClipContentControl.vue'
import FlexControls from '@/components/properties/layout/flex/FlexControls.vue'
import GridControls from '@/components/properties/layout/grid/GridControls.vue'
import LayoutFlowControl from '@/components/properties/layout/LayoutFlowControl.vue'
import PaddingControls from '@/components/properties/layout/padding/PaddingControls.vue'
import SizeControls from '@/components/properties/layout/size/SizeControls.vue'
import TextResizingControl from '@/components/properties/layout/TextResizingControl.vue'
import IconButton from '@/components/ui/button/IconButton.vue'
import PanelFieldGroup from '@/components/ui/panel/PanelFieldGroup.vue'
import PanelSection from '@/components/ui/panel/PanelSection.vue'

const { panels } = useI18n()

const { nodes, allContainers, allText, allAutoLayout, allFlex, allGrid, setMode } =
  useSelectionLayout()
</script>

<template>
  <LayoutControlsRoot>
    <template v-if="nodes.length">
      <PanelSection :label="!allAutoLayout ? panels.layout : panels.autoLayout">
        <template v-if="allContainers" #actions>
          <IconButton
            :label="!allAutoLayout ? panels.addAutoLayout : panels.removeAutoLayout"
            size="xs"
            :active="allAutoLayout"
            class="data-[state=on]:bg-accent/15"
            @click="setMode(!allAutoLayout ? 'VERTICAL' : 'NONE')"
          >
            <icon-lucide-layout-panel-top class="size-3.5" />
          </IconButton>
        </template>

        <LayoutFlowControl v-if="allContainers" />
        <TextResizingControl v-if="allText" />
        <PanelFieldGroup
          :label="!allText ? panels.dimensions : undefined"
          :data-labeled="!allText || undefined"
          class="data-[labeled]:mt-field-group"
        >
          <div><SizeControls /></div>
        </PanelFieldGroup>
        <ClipContentControl v-if="allContainers && !allAutoLayout" />

        <template v-if="allContainers && allAutoLayout">
          <FlexControls v-if="allFlex" />
          <template v-else>
            <GridControls v-if="allGrid" />
            <PaddingControls />
            <ClipContentControl />
          </template>
        </template>
      </PanelSection>
    </template>
  </LayoutControlsRoot>
</template>
