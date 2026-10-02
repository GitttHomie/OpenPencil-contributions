<script setup lang="ts">
import { designModelProfile } from '@/app/ai/models/store'
import ChatProfileSelect from '@/components/chat/ChatProfileSelect.vue'
import ModelsPanel from '@/components/settings/models/ModelsPanel.vue'
</script>

<template>
  <div class="mx-auto flex h-screen max-w-2xl flex-col gap-4 bg-panel p-5 text-surface">
    <ChatProfileSelect
      ><template #value>{{ designModelProfile?.name }}</template></ChatProfileSelect
    >
    <ModelsPanel />
  </div>
</template>
