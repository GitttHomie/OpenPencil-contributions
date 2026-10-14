<script setup lang="ts">
import { useStore } from '@nanostores/vue'
import { computed, useTemplateRef, type ComponentPublicInstance } from 'vue'

import { filesMessages } from '@open-pencil/vue'

import { answerCleanupPrompt, cleanupPrompt } from '@/app/document/io/cleanup-prompt'
import AppButton from '@/components/ui/button/AppButton.vue'
import AppAlertDialogRoot from '@/components/ui/dialog/AppAlertDialogRoot.vue'
import AppDialogBody from '@/components/ui/dialog/AppDialogBody.vue'
import AppDialogFooter from '@/components/ui/dialog/AppDialogFooter.vue'
import AppDialogHeader from '@/components/ui/dialog/AppDialogHeader.vue'
import AppAlert from '@/components/ui/feedback/AppAlert.vue'

const files = useStore(filesMessages)
const keepButton = useTemplateRef<ComponentPublicInstance>('keepButton')
function focusKeep(event: Event) {
  const element: unknown = keepButton.value?.$el
  if (!(element instanceof HTMLElement)) return
  event.preventDefault()
  element.focus()
}
const open = computed({
  get: () => cleanupPrompt.value !== null,
  set: (value: boolean) => {
    if (!value) answerCleanupPrompt('keep')
  }
})
</script>

<template>
  <AppAlertDialogRoot
    v-if="open"
    v-model:open="open"
    size="lg"
    @open-auto-focus="focusKeep"
    @escape-key-down="answerCleanupPrompt('keep')"
  >
    <AppDialogHeader
      :heading="files.cleanupHeading"
      :description="files.cleanupIntro({ name: cleanupPrompt?.fileName ?? '' })"
      :show-close="false"
    />
    <AppDialogBody :ui="{ body: 'space-y-3' }">
      <AppAlert
        v-if="cleanupPrompt?.unused.componentCount"
        :heading="files.cleanupRemove"
        :description="files.cleanupDescription({ count: cleanupPrompt.unused.componentCount })"
      >
        <template #actions>
          <AppButton color="primary" variant="solid" @click="answerCleanupPrompt('unused')">
            {{ files.cleanupRemove }}
          </AppButton>
        </template>
      </AppAlert>
      <AppAlert
        v-if="cleanupPrompt?.internal.nodeCount"
        tone="warning"
        :heading="files.cleanupInternalHeading"
        :description="
          files.cleanupInternalDescription({
            canvases: cleanupPrompt.internal.canvasCount,
            components: cleanupPrompt.internal.componentCount,
            instances: cleanupPrompt.internal.instanceCount,
            pages: cleanupPrompt.internal.pageCount
          })
        "
      >
        <template #details>
          <p>{{ files.cleanupInternalWarning }}</p>
          <p v-if="cleanupPrompt.internal.hiddenInstanceCount">
            {{
              files.cleanupHiddenInstances({ count: cleanupPrompt.internal.hiddenInstanceCount })
            }}
          </p>
        </template>
        <template #actions>
          <AppButton color="error" variant="solid" @click="answerCleanupPrompt('internal')">
            {{ files.cleanupInternalRemove }}
          </AppButton>
        </template>
      </AppAlert>
    </AppDialogBody>
    <AppDialogFooter :ui="{ footer: 'flex-wrap' }">
      <AppButton
        ref="keepButton"
        color="neutral"
        variant="outline"
        @click="answerCleanupPrompt('keep')"
      >
        {{ files.cleanupKeep }}
      </AppButton>
    </AppDialogFooter>
  </AppAlertDialogRoot>
</template>
