<script setup lang="ts">
import { computed } from 'vue'

import { MIXED } from '#vue/controls/node-props/use'
import { usePosition } from '#vue/controls/position/use'

const {
  updateProp,
  commitProp,
  cancelProp,
  node,
  ids,
  align,
  flip,
  rotate,
  isMulti,
  active,
  canPosition,
  canExclude,
  excluded,
  setExcluded,
  prop: multiProp
} = usePosition()

const xValue = computed(() => (isMulti.value ? multiProp('x').value : (node.value?.x ?? 0)))
const yValue = computed(() => (isMulti.value ? multiProp('y').value : (node.value?.y ?? 0)))
const wValue = multiProp('width')
const hValue = multiProp('height')
const rotationValue = computed(() =>
  isMulti.value ? multiProp('rotation').value : Math.round(node.value?.rotation ?? 0)
)
const actions = {
  setExcluded,
  updateProp,
  commitProp,
  cancelProp,
  align,
  flip,
  rotate
}
</script>

<template>
  <slot
    :active="active"
    :can-position="canPosition"
    :can-exclude="canExclude"
    :excluded="excluded"
    :is-multi="isMulti"
    :ids="ids"
    :x-value="xValue"
    :y-value="yValue"
    :w-value="wValue"
    :h-value="hValue"
    :rotation-value="rotationValue"
    :mixed="MIXED"
    :actions="actions"
  />
</template>
