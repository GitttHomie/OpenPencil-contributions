import { expect, test } from 'bun:test'

import { computed, effectScope } from 'vue'

import { createEditor } from '@open-pencil/core/editor'

import { createTypographyActions } from '#vue/controls/typography/actions'
import { useFontStyleOptions } from '#vue/controls/typography/styles'

function setup() {
  const editor = createEditor()
  const first = editor.graph.createNode('TEXT', editor.state.currentPageId, {
    text: 'First',
    fontFamily: 'First family',
    fontWeight: 600,
    fontSize: 16,
    textAutoResize: 'NONE'
  })
  const second = editor.graph.createNode('TEXT', editor.state.currentPageId, {
    text: 'Second',
    fontFamily: 'Second family',
    fontWeight: 400,
    fontSize: 24,
    textAutoResize: 'NONE'
  })
  editor.select([first.id, second.id])
  const requests: string[] = []
  const nodes = computed(() => [first, second])
  const scope = effectScope()
  const actions = scope.run(() =>
    createTypographyActions({
      editor,
      nodes,
      node: computed(() => null),
      currentWeightLabel: computed(() => ''),
      activeFormatting: computed(() => []),
      options: {
        fontLoader: {
          load: async (family, style) => {
            requests.push(`${family}: ${style}`)
          },
          styles: (family) => (family === 'Display' ? ['Regular'] : ['Regular', 'SemiBold'])
        }
      }
    })
  )
  if (!actions) throw new Error('Missing typography actions')
  return {
    editor,
    first,
    second,
    nodes,
    actions,
    requests,
    dispose() {
      scope.stop()
      editor.dispose()
    }
  }
}

test('a family change chooses available faces for all texts and undoes as one edit', async () => {
  const scene = setup()
  try {
    await scene.actions.setFamily('Display')
    expect(scene.requests).toEqual(['Display: Regular', 'Display: Regular'])
    expect(scene.nodes.value.map((node) => [node.fontFamily, node.fontWeight])).toEqual([
      ['Display', 400],
      ['Display', 400]
    ])
    scene.editor.undoAction()
    expect(scene.nodes.value.map((node) => [node.fontFamily, node.fontWeight])).toEqual([
      ['First family', 600],
      ['Second family', 400]
    ])
    expect(scene.editor.undo.canUndo).toBe(false)
  } finally {
    scene.dispose()
  }
})

test('alignment and numeric previews affect all texts and preserve fixed text sizing', () => {
  const scene = setup()
  try {
    scene.actions.setAlign('CENTER')
    expect(scene.nodes.value.map((node) => node.textAlignHorizontal)).toEqual(['CENTER', 'CENTER'])
    scene.editor.undoAction()
    expect(scene.nodes.value.map((node) => node.textAlignHorizontal)).toEqual(['LEFT', 'LEFT'])
    scene.actions.updateProp('fontSize', 32)
    scene.actions.commitProp('fontSize', 32, 16)
    expect(scene.nodes.value.map((node) => [node.fontSize, node.textAutoResize])).toEqual([
      [32, 'NONE'],
      [32, 'NONE']
    ])
    scene.editor.undoAction()
    expect(scene.nodes.value.map((node) => node.fontSize)).toEqual([16, 24])
  } finally {
    scene.dispose()
  }
})

test('unsupported weights are rejected atomically and options intersect the available families', async () => {
  const scene = setup()
  const scope = effectScope()
  try {
    await scene.actions.setWeight(900)
    expect(scene.requests).toEqual([])
    expect(scene.nodes.value.map((node) => node.fontWeight)).toEqual([600, 400])
    const styles = scope.run(() =>
      useFontStyleOptions(
        computed(() => null),
        {
          load: async () => undefined,
          styles: (family) =>
            family === 'First family' ? ['Regular', 'Bold'] : ['Regular', 'SemiBold']
        },
        scene.nodes
      )
    )
    expect(styles?.weights.value.map((weight) => weight.value)).toEqual([400])
  } finally {
    scope.stop()
    scene.dispose()
  }
})
