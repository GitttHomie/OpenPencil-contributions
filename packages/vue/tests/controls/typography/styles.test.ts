import { expect, test } from 'bun:test'

import { computed, effectScope, nextTick, ref } from 'vue'

import { createDefaultNode } from '@open-pencil/scene-graph/node-defaults'

import { useFontStyleOptions } from '#vue/controls/typography/styles'

test('weight options follow family and slant while unsupported format buttons are disabled', () => {
  const scope = effectScope()
  try {
    scope.run(() => {
      const node = ref(createDefaultNode(() => 'type', 'TEXT', { fontFamily: 'Display' }))
      const state = useFontStyleOptions(
        computed(() => node.value),
        {
          load: async () => undefined,
          styles: (family) =>
            family === 'Display' ? ['Regular'] : ['Regular', 'Bold', 'Regular Italic']
        }
      )
      expect(state.weights.value.map((weight) => weight.value)).toEqual([400])
      expect(state.canToggleBold.value).toBe(false)
      expect(state.canToggleItalic.value).toBe(false)
      node.value.fontFamily = 'Text'
      expect(state.weights.value.map((weight) => weight.value)).toEqual([400, 700])
      expect(state.canToggleItalic.value).toBe(true)
      node.value.italic = true
      expect(state.weights.value.map((weight) => weight.value)).toEqual([400])
    })
  } finally {
    scope.stop()
  }
})

test('metadata completion refreshes options for a reopened text node', async () => {
  let styles: string[] = []
  let finish: (() => void) | undefined
  const scope = effectScope()
  const state = scope.run(() =>
    useFontStyleOptions(
      computed(() => createDefaultNode(() => 'type', 'TEXT', { fontFamily: 'Display' })),
      {
        load: async () => undefined,
        styles: () => styles,
        loadStyles: () =>
          new Promise<void>((resolve) => {
            finish = resolve
          })
      }
    )
  )
  try {
    expect(state?.weights.value).toEqual([])
    styles = ['Regular']
    finish?.()
    await nextTick()
    expect(state?.weights.value.map((weight) => weight.value)).toEqual([400])
  } finally {
    scope.stop()
  }
})
