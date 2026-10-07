<script setup lang="ts">
import { computed } from 'vue'

import type { EditorState } from '@open-pencil/core/editor'
import { colorToCSS } from '@open-pencil/scene-graph/color'

import { hasAgentPointer } from '@/app/presence/cursor-presentation'
import { animationsEnabled } from '@/app/shell/motion'
import { agentCursors } from '@/theme/collaboration/agent-cursors'

const { viewport } = defineProps<{
  viewport: Pick<EditorState, 'panX' | 'panY' | 'zoom' | 'currentPageId' | 'presenceCursors'>
}>()
const ui = agentCursors()
const agents = computed(() => viewport.presenceCursors.filter(hasAgentPointer))

// Animate document coordinates. The outer camera transform and inverse artwork scale keep
// panning/zooming immediate and the cursor a constant screen size, even during a glide.
const camera = computed(() => ({
  transform: `translate3d(${viewport.panX}px, ${viewport.panY}px, 0) scale(${viewport.zoom})`
}))
const artwork = computed(() => ({ transform: `scale(${1 / viewport.zoom})` }))
</script>

<template>
  <div v-if="agents.length" :class="ui.root()" aria-hidden="true" data-test-id="agent-cursors">
    <div :class="ui.plane()" :style="camera">
      <div
        v-for="agent in agents"
        :key="`${viewport.currentPageId}:${agent.id}`"
        :class="ui.pointer()"
        :data-agent-id="agent.id"
        :data-animated="animationsEnabled"
        :style="{
          transform: `translate3d(${agent.x}px, ${agent.y}px, 0)`,
          color: colorToCSS(agent.color)
        }"
      >
        <div :class="ui.artwork()" :style="artwork">
          <icon-lucide-mouse-pointer-2 :class="ui.arrow()" />
          <span v-if="agent.name" :class="ui.label()">
            <icon-lucide-sparkle :class="ui.sparkle()" />
            <span :class="ui.name()">{{ agent.name }}</span>
          </span>
        </div>
      </div>
    </div>
  </div>
</template>
