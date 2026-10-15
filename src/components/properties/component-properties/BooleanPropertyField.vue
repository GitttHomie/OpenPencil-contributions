<script setup lang="ts">
import { computed } from 'vue'

import type { SceneNode } from '@open-pencil/scene-graph'
import {
  useComponentPropertyVariableProvider,
  useEditor,
  usePanelMessages,
  useSceneComputed
} from '@open-pencil/vue'

import VisibilityField from '@/components/properties/visibility/VisibilityField.vue'
import IconButton from '@/components/ui/button/IconButton.vue'

const { nodes, propertyId, kind, label, state, id, disabled } = defineProps<{
  nodes: SceneNode[]
  propertyId: string
  kind: 'default' | 'instance'
  label: string
  state: 'visible' | 'hidden' | 'mixed'
  id?: string
  disabled?: boolean
}>()
defineEmits<{ toggle: [] }>()
const editor = useEditor()
const panels = usePanelMessages()
const provider = useComponentPropertyVariableProvider(() => kind)
const targets = computed(() => nodes.map((node) => ({ nodeId: node.id, path: propertyId })))
const overridden = useSceneComputed(
  () =>
    kind === 'instance' &&
    nodes.some((node) => {
      const target = editor.getInstanceComponentPropertyTarget(node.id, propertyId)
      return (
        target &&
        (Object.hasOwn(target.instance.componentPropertyAssignments, target.definition.id) ||
          Object.hasOwn(target.instance.componentPropertyVariableAssignments, target.definition.id))
      )
    })
)
function reset() {
  editor.undo.runBatch('Reset component property', () => {
    for (const node of nodes) editor.resetInstanceComponentProperty(node.id, propertyId)
  })
}
</script>

<template>
  <VisibilityField
    :id="id"
    :disabled="disabled"
    :nodes="nodes"
    :state="state"
    :label="label"
    :binding-provider="provider"
    :binding-targets="targets"
    @toggle="$emit('toggle')"
  >
    <template #actions>
      <IconButton
        v-if="overridden"
        :disabled="disabled"
        :label="`${panels.useSharedDefault}: ${label}`"
        @click="reset"
      >
        <icon-lucide-rotate-ccw class="size-3.5" />
      </IconButton>
    </template>
  </VisibilityField>
</template>
