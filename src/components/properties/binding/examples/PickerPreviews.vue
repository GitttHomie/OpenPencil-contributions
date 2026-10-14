<script setup lang="ts">
import { computed, onScopeDispose, ref } from 'vue'

import { createEditor } from '@open-pencil/core/editor'
import type { Color } from '@open-pencil/scene-graph'
import { BindableValueRoot, type BindingProvider } from '@open-pencil/vue'

import VariableBindingPicker from '@/components/properties/binding/VariableBindingPicker.vue'
import AppButton from '@/components/ui/button/AppButton.vue'

const editor = createEditor()
onScopeDispose(() => editor.dispose())
const graph = editor.graph
const collection = graph.createCollection('Preview tokens')
graph.addMode(collection.id, 'alternate', 'Alternate')
const red = graph.createVariable('Color/Coral', 'COLOR', collection.id, {
  r: 1,
  g: 0.25,
  b: 0.2,
  a: 1
})
graph.createVariable('Color/Transparent blue', 'COLOR', collection.id, {
  r: 0.1,
  g: 0.35,
  b: 1,
  a: 0.4
})
graph.createVariable('Color/Action alias', 'COLOR', collection.id, { aliasId: red.id })
graph.createVariable('Space/None', 'FLOAT', collection.id, 0)
const space = graph.createVariable('Space/Control', 'FLOAT', collection.id, 12.5)
graph.createVariable('Space/Alias', 'FLOAT', collection.id, { aliasId: space.id })
editor.updateVariableValue(red.id, 'alternate', { r: 0.2, g: 0.7, b: 0.3, a: 1 })
editor.updateVariableValue(space.id, 'alternate', 24)
const node = graph.createNode('FRAME', editor.state.currentPageId, {
  fills: [{ type: 'SOLID', visible: true, opacity: 1, color: { r: 1, g: 0.25, b: 0.2, a: 1 } }]
})
const revision = ref(0)
const alternate = ref(false)
function provider(type: 'COLOR' | 'FLOAT'): BindingProvider<Color | number> {
  return {
    revision,
    listVariables: () => editor.getVariablesByType(type),
    filterVariables: () => editor.getVariablesByType(type),
    getBindingId: (target) => node.boundVariables[target.path],
    getBound: (target) => editor.getVariable(node.boundVariables[target.path] ?? ''),
    getState: (targets) =>
      targets.some((target) => node.boundVariables[target.path]) ? 'bound' : 'unbound',
    resolve: (id) =>
      type === 'COLOR'
        ? graph.resolveColorVariableForNode(node.id, id)
        : graph.resolveNumberVariableForNode(node.id, id),
    bind: (target, id) => {
      editor.bindVariable(target.nodeId, target.path, id)
      revision.value++
    },
    unbind: (target) => {
      editor.unbindVariable(target.nodeId, target.path)
      revision.value++
    }
  }
}
const colorProvider = provider('COLOR')
const numberProvider = provider('FLOAT')
colorProvider.bind({ nodeId: node.id, path: 'fills/0/color' }, red.id)
const modeLabel = computed(() => (alternate.value ? 'Use default mode' : 'Use alternate mode'))
function changeMode() {
  alternate.value = !alternate.value
  graph.updateNode(node.id, {
    variableModes: alternate.value ? { [collection.id]: 'alternate' } : {}
  })
  revision.value++
}
</script>

<template>
  <div class="flex w-96 flex-col gap-4 rounded bg-panel p-4">
    <AppButton @click="changeMode">{{ modeLabel }}</AppButton>
    <div class="flex items-center justify-between text-xs">
      <span>Color variable (already bound to Coral)</span>
      <BindableValueRoot
        :provider="colorProvider"
        :targets="[{ nodeId: node.id, path: 'fills/0/color' }]"
        :value="{ r: 1, g: 0.25, b: 0.2, a: 1 }"
      >
        <VariableBindingPicker
          trigger-label="Choose color variable"
          search-placeholder="Search variables"
          empty-label="No variables"
          detach-label="Detach variable"
        />
      </BindableValueRoot>
    </div>
    <div class="flex items-center justify-between text-xs">
      <span>Numeric variable</span>
      <BindableValueRoot
        :provider="numberProvider"
        :targets="[{ nodeId: node.id, path: 'width' }]"
        :value="12.5"
      >
        <VariableBindingPicker
          trigger-label="Choose numeric variable"
          search-placeholder="Search variables"
          empty-label="No variables"
          detach-label="Detach variable"
        />
      </BindableValueRoot>
    </div>
  </div>
</template>
