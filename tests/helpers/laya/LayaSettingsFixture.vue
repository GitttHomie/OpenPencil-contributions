<script setup lang="ts">
import { LAYA_SUPPORTED } from '@/app/ai/routing/preferences'
import LayaSettings from '@/components/settings/models/LayaSettings.vue'
import RoleAssignments from '@/components/settings/models/RoleAssignments.vue'
</script>

<template>
  <main class="mx-auto flex max-w-2xl flex-col gap-4 bg-panel p-5 text-surface">
    <RoleAssignments />
    <LayaSettings v-if="LAYA_SUPPORTED" />
  </main>
</template>
