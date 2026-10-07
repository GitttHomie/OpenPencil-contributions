<script setup lang="ts">
import { AlertDialogDescription, AlertDialogTitle } from 'reka-ui'
import { computed, useTemplateRef } from 'vue'

import { acpPermissionOptionTestId, useI18n, vTestId } from '@open-pencil/vue'

import {
  currentPermission,
  canAllowCanvasForChat,
  allowCanvasForChat,
  cancelCurrentPermission,
  respondToPermission
} from '@/app/ai/acp/permission'
import type AppButton from '@/components/ui/button/AppButton.vue'
import { AppAlertDialogRoot } from '@/components/ui/dialog'

const open = computed(() => currentPermission.value !== null)
const cancelButton = useTemplateRef<InstanceType<typeof AppButton>>('cancelButton')
function focusCancel(event: Event) {
  const element: unknown = cancelButton.value?.$el
  if (!(element instanceof HTMLElement)) return
  event.preventDefault()
  element.focus()
}
const { ai, common } = useI18n()
interface ToolCallInfo {
  title?: string
  rawInput?: unknown
}

const toolCall = computed(
  (): ToolCallInfo => (currentPermission.value?.request.toolCall as ToolCallInfo) ?? {}
)

const toolName = computed(() => toolCall.value.title ?? ai.value.unknownTool)

const toolInput = computed(() => {
  const raw = toolCall.value.rawInput
  if (!raw) return null
  try {
    return JSON.stringify(raw, null, 2)
  } catch {
    return String(raw)
  }
})

const allowOptions = computed(
  () => currentPermission.value?.request.options.filter((o) => o.kind.startsWith('allow')) ?? []
)

const rejectOptions = computed(
  () => currentPermission.value?.request.options.filter((o) => o.kind.startsWith('reject')) ?? []
)
</script>

<template>
  <AppAlertDialogRoot
    :open="open"
    :ui="{ overlay: 'z-50', content: 'w-80 rounded-lg p-4 shadow-xl' }"
    data-test-id="acp-permission-dialog"
    @open-auto-focus="focusCancel"
    @escape-key-down.prevent
  >
    <AlertDialogTitle class="text-sm font-semibold text-surface">
      {{ ai.permissionRequestTitle }}
    </AlertDialogTitle>

    <AlertDialogDescription class="mt-2 text-xs text-muted">
      {{ ai.permissionRequest({ tool: toolName }) }}
    </AlertDialogDescription>

    <pre
      v-if="toolInput"
      class="mt-2 max-h-32 overflow-auto rounded bg-input p-2 text-[10px] text-muted"
      >{{ toolInput }}</pre>

    <div class="mt-4 flex flex-col gap-2">
      <!-- Only the permission queue closes this dialog: another request may already be waiting. -->
      <AppButton
        v-if="canAllowCanvasForChat"
        color="primary"
        variant="solid"
        class="w-full"
        @click="allowCanvasForChat"
      >
        {{ ai.allowCanvasForChat }}
      </AppButton>
      <p v-if="canAllowCanvasForChat" class="text-[10px] text-muted">
        {{ ai.allowCanvasForChatHint }}
      </p>
      <AppButton
        v-for="opt in allowOptions"
        :key="opt.optionId"
        v-test-id="acpPermissionOptionTestId(opt.kind)"
        color="primary"
        variant="solid"
        class="w-full"
        @click="respondToPermission(opt.optionId)"
      >
        {{ opt.name }}
      </AppButton>

      <AppButton
        v-for="opt in rejectOptions"
        :key="opt.optionId"
        v-test-id="acpPermissionOptionTestId(opt.kind)"
        variant="outline"
        class="w-full"
        @click="respondToPermission(opt.optionId)"
      >
        {{ opt.name }}
      </AppButton>
      <AppButton
        ref="cancelButton"
        variant="outline"
        class="w-full"
        @click="cancelCurrentPermission"
      >
        {{ common.cancel }}
      </AppButton>
    </div>
  </AppAlertDialogRoot>
</template>
