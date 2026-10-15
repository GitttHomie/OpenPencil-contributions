<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import { hasVisibilityVariableOverride, type SceneNode } from '@open-pencil/scene-graph'
import {
  type BindingTarget,
  type BindingProvider,
  BindableValueRoot,
  useCommonMessages,
  useEditor,
  useOpenPencilBindingProvider,
  usePanelMessages,
  useRetainedPopup
} from '@open-pencil/vue'

import { BindingPill, VariablePicker } from '@/components/ui/binding'
import { AppConfirmationDialog } from '@/components/ui/dialog'
import Tip from '@/components/ui/overlay/Tip.vue'
import PanelItemRow from '@/components/ui/panel/PanelItemRow.vue'
import AppSwitch from '@/components/ui/toggle/AppSwitch.vue'

const {
  nodes,
  state,
  linked = false,
  propertyNames = [],
  label,
  id,
  bindingProvider,
  bindingTargets,
  disabled = false
} = defineProps<{
  nodes: SceneNode[]
  state: 'visible' | 'hidden' | 'mixed'
  linked?: boolean
  propertyNames?: string[]
  label?: string
  id?: string
  bindingProvider?: BindingProvider<boolean>
  bindingTargets?: BindingTarget[]
  disabled?: boolean
}>()
const emit = defineEmits<{ toggle: [] }>()
const editor = useEditor()
const panels = usePanelMessages()
const common = useCommonMessages()
const targets = computed(
  () => bindingTargets ?? nodes.map((node) => ({ nodeId: node.id, path: 'visible' }))
)
const propertyLinked = computed(
  () =>
    linked &&
    nodes.some(
      (node) =>
        node.componentPropertyReferences.some((ref) => ref.field === 'VISIBLE') &&
        !hasVisibilityVariableOverride(editor.graph, node)
    )
)
const baseProvider = useOpenPencilBindingProvider<boolean>({
  type: 'BOOLEAN',
  resolve(editor, id, target) {
    const value = target
      ? editor.graph.resolveVariableForNode(target.nodeId, id)
      : editor.graph.resolveVariable(id)
    return typeof value === 'boolean' ? value : undefined
  }
})
const localProvider = {
  ...baseProvider,
  bind(target: BindingTarget, id: string) {
    const context = editor.getComponentPropertyAuthoring(target.nodeId)
    if (context?.fields.includes('VISIBLE')) {
      editor.bindComponentProperty(target.nodeId, 'VISIBLE', null)
    }
    baseProvider.bind(target, id)
  }
}
const provider = computed(() => bindingProvider ?? localProvider)
const pending = ref<(() => void) | null>(null)
const { open: confirming, portalActive } = useRetainedPopup(ref(false), () => {
  pending.value = null
})
watch(
  () => nodes.map((node) => node.id).join(','),
  () => {
    confirming.value = false
    pending.value = null
  },
  { flush: 'sync' }
)
function choose(id: string, bind: (id: string) => void) {
  if (propertyLinked.value) {
    pending.value = () => bind(id)
    confirming.value = true
  } else bind(id)
}
function confirm() {
  const apply = pending.value
  pending.value = null
  confirming.value = false
  apply?.()
}
const items = computed(() => {
  void provider.value.revision?.value
  return provider.value.listVariables().map((variable) => {
    const values = targets.value.map((target) => provider.value.resolve(variable.id, target))
    const value = values[0]
    let text = String(value)
    if (values.some((item) => item === undefined)) text = panels.value.unresolvedVariable
    else if (!values.every((item) => item === value)) text = panels.value.mixed
    return {
      id: variable.id,
      name: variable.name,
      collection: provider.value.collectionName?.(variable),
      text
    }
  })
})
defineOptions({ inheritAttrs: false })
</script>

<template>
  <BindableValueRoot
    v-slot="binding"
    :provider="provider"
    :targets="targets"
    :value="state === 'visible'"
    policy="readonly-when-bound"
  >
    <PanelItemRow data-property="visibility" v-bind="$attrs">
      <span class="flex-1 text-xs text-muted">{{ label ?? panels.layerVisibility }}</span>
      <Tip v-if="propertyLinked" :label="propertyNames.join(', ')">
        <span role="img" :aria-label="`${panels.layerVisibility}: ${propertyNames.join(', ')}`">
          <icon-lucide-link class="size-3.5 text-accent" />
        </span>
      </Tip>
      <slot name="actions" />
      <AppSwitch
        :id="id"
        :label="label ?? panels.layerVisibility"
        :model-value="state === 'visible'"
        :state="state === 'mixed' ? 'mixed' : 'idle'"
        :disabled="disabled || propertyLinked || binding.state !== 'unbound'"
        @update:model-value="emit('toggle')"
      />
      <template #rail>
        <VariablePicker
          :trigger-label="
            label ? `${label}: ${panels.visibilityVariable}` : panels.visibilityVariable
          "
          :search-placeholder="panels.variables"
          :empty-label="panels.noVariablesFound"
          :detach-label="panels.detachVariable"
          :items="items"
          :disabled="disabled || !targets.length"
          :selected="binding.variable?.id"
          :state="binding.state"
          :open="binding.open"
          @update:open="
            (open) => (open ? binding.actions.openPicker() : binding.actions.closePicker())
          "
          @select="
            (id) => {
              binding.actions.closePicker()
              choose(id, binding.actions.bind)
            }
          "
          @detach="binding.actions.unbind"
        />
      </template>
      <template v-if="binding.state !== 'unbound'" #details>
        <BindingPill
          :label="
            binding.mixedBindings
              ? panels.mixedBindings
              : (binding.variable?.name ?? panels.unresolvedVariable)
          "
          :value="state === 'mixed' ? panels.mixed : String(state === 'visible')"
          :unresolved="binding.unresolved"
        />
      </template>
    </PanelItemRow>
  </BindableValueRoot>
  <AppConfirmationDialog
    v-if="portalActive"
    v-model:open="confirming"
    :heading="panels.replaceVisibilityLink"
    :description="panels.replaceVisibilityLinkDescription"
    :cancel-label="common.cancel"
    :confirm-label="panels.applyVariable"
    tone="warning"
    @confirm="confirm"
  />
</template>
