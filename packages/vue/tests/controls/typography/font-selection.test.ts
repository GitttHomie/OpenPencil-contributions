import { expect, test } from 'bun:test'

import { computed, shallowRef } from 'vue'

import { createEditor } from '@open-pencil/core/editor'
import { documentFontStatus, FontManager } from '@open-pencil/core/text'

import { createTypographyActions } from '#vue/controls/typography/actions'
import type { TypographyFontLoader } from '#vue/controls/typography/use'

function setup(
  load: TypographyFontLoader['load'],
  fontWeight = 600,
  italic = false,
  styles?: TypographyFontLoader['styles']
) {
  const editor = createEditor()
  const text = editor.graph.createNode('TEXT', editor.state.currentPageId, {
    text: 'Font selection',
    fontFamily: 'Original',
    fontWeight,
    italic
  })
  editor.select([text.id])
  const selected = shallowRef(text)
  const actions = createTypographyActions({
    editor,
    node: computed(() => selected.value),
    currentWeightLabel: computed(() => 'Semi Bold'),
    activeFormatting: computed(() => []),
    options: { fontLoader: { load, styles } }
  })
  return { editor, text, selected, actions }
}

for (const [weight, italic, style] of [
  [200, false, 'ExtraLight'],
  [600, false, 'SemiBold'],
  [800, true, 'ExtraBold Italic']
] as const) {
  test(`the first family selection requests the exact ${style} face`, async () => {
    const manager = new FontManager()
    const requests: unknown[][] = []
    const { editor, text, actions } = setup(
      async (...args) => {
        requests.push(args)
        expect(text.fontFamily).toBe('Original')
        manager.markLoaded(args[0], args[1], new ArrayBuffer(8), 'google')
      },
      weight,
      italic
    )
    try {
      await actions.setFamily('Downloaded')
      expect(requests).toEqual([['Downloaded', style, 'Font selection']])
      expect(documentFontStatus(editor.graph, text.id, manager).issues).toEqual([])
      editor.undoAction()
      expect(text.fontFamily).toBe('Original')
    } finally {
      editor.dispose()
    }
  })
}

test('a choice commits immediately and survives deselection while the font downloads', async () => {
  let finish: (() => void) | undefined
  const { editor, text, selected, actions } = setup(
    () =>
      new Promise<void>((resolve) => {
        finish = resolve
      })
  )
  try {
    const request = actions.setFamily('Downloaded')
    expect(text.fontFamily).toBe('Downloaded')
    expect(editor.undo.canUndo).toBe(true)
    const other = editor.graph.createNode('TEXT', editor.state.currentPageId, {
      fontFamily: 'Other'
    })
    selected.value = other
    editor.select([other.id])
    finish?.()
    await request
    expect(text.fontFamily).toBe('Downloaded')
    expect(other.fontFamily).toBe('Other')
    editor.undoAction()
    expect(text.fontFamily).toBe('Original')
  } finally {
    editor.dispose()
  }
})

test('the latest family choice wins when downloads finish out of order', async () => {
  const pending = new Map<string, () => void>()
  const { editor, text, actions } = setup(
    (family) =>
      new Promise<void>((resolve) => {
        pending.set(family, resolve)
      })
  )
  try {
    const first = actions.setFamily('First')
    const second = actions.setFamily('Second')
    pending.get('Second')?.()
    await second
    pending.get('First')?.()
    await first
    expect(text.fontFamily).toBe('Second')
    editor.undoAction()
    expect(text.fontFamily).toBe('First')
    editor.undoAction()
    expect(text.fontFamily).toBe('Original')
    expect(editor.undo.canUndo).toBe(false)
  } finally {
    editor.dispose()
  }
})

test('selecting a regular-only local family changes unsupported weight and italic in one undo step', async () => {
  const requests: unknown[][] = []
  const { editor, text, actions } = setup(
    async (...args) => {
      requests.push(args)
    },
    600,
    true,
    () => ['Regular']
  )
  try {
    await actions.setFamily('Academy Engraved LET')
    expect(requests).toEqual([['Academy Engraved LET', 'Regular', 'Font selection']])
    expect(text.fontFamily).toBe('Academy Engraved LET')
    expect(text.fontWeight).toBe(400)
    expect(text.italic).toBe(false)
    editor.undoAction()
    expect(text.fontFamily).toBe('Original')
    expect(text.fontWeight).toBe(600)
    expect(text.italic).toBe(true)
    expect(editor.undo.canUndo).toBe(false)
  } finally {
    editor.dispose()
  }
})

test('Undo during a font download is not overwritten by completion', async () => {
  let finish: (() => void) | undefined
  const { editor, text, actions } = setup(
    () =>
      new Promise<void>((resolve) => {
        finish = resolve
      })
  )
  try {
    const request = actions.setFamily('Downloaded')
    editor.undoAction()
    finish?.()
    await request
    expect(text.fontFamily).toBe('Original')
    expect(editor.undo.canRedo).toBe(true)
  } finally {
    editor.dispose()
  }
})

test('weight changes retain italic and wait for the exact face', async () => {
  const requests: unknown[][] = []
  const { editor, text, actions } = setup(
    async (...args) => {
      requests.push(args)
      expect(text.fontWeight).toBe(600)
    },
    600,
    true
  )
  try {
    await actions.setWeight(800)
    expect(requests).toEqual([['Original', 'ExtraBold Italic', 'Font selection']])
    expect(text.fontWeight).toBe(800)
  } finally {
    editor.dispose()
  }
})
