<script setup lang="ts">
import { computed } from 'vue'

import { projectChatMedia } from '@/app/ai/chat/media'
import { markdownRenderKey, type MarkdownSurface } from '@/app/shell/markdown/state'
import ChatImagePreview from '@/components/chat/ChatImagePreview.vue'
import MarkdownContent from '@/components/markdown/MarkdownContent.vue'

const {
  content,
  mode = 'static',
  surface = 'message'
} = defineProps<{
  content: string
  mode?: 'static' | 'streaming'
  surface?: MarkdownSurface
}>()

const renderKey = computed(() => markdownRenderKey({ mode, surface }))
const media = computed(() => projectChatMedia(content))
const images = computed(() => (mode === 'static' ? media.value.images : []))
const displayed = computed(() =>
  typeof media.value.value === 'string'
    ? media.value.value
    : JSON.stringify(media.value.value, null, 2)
)
</script>

<template>
  <div>
    <MarkdownContent
      :key="renderKey"
      data-slot="chat-markdown"
      :content="displayed"
      :mode="mode"
      density="compact"
      highlight-code
    />
    <ChatImagePreview v-for="image in images" :key="image.url" :image="image" label="Image" />
  </div>
</template>
