import { computed } from 'vue'
import type { ComputedRef } from 'vue'

import type { Editor } from '@open-pencil/core/editor'
import { FONT_WEIGHT_NAMES, weightToStyle } from '@open-pencil/core/text'
import { parseFontStyle } from '@open-pencil/scene-graph'
import type { SceneNode, TextDecoration } from '@open-pencil/scene-graph'

import type { UseTypographyOptions } from '#vue/controls/typography/use'
import { useSceneComputed } from '#vue/internal/scene-computed/use'
import { useNodeFontStatus } from '#vue/shared/font-status/use'

type TextAlign = SceneNode['textAlignHorizontal']
type TextDirection = SceneNode['textDirection']
type TextVerticalAlign = SceneNode['textAlignVertical']
type TextCase = SceneNode['textCase']
type TextTruncation = SceneNode['textTruncation']

export const TYPOGRAPHY_WEIGHTS = Object.entries(FONT_WEIGHT_NAMES).map(([value, label]) => ({
  value: Number(value),
  label
}))

export function createTypographyState(editor: Editor) {
  const node = useSceneComputed<SceneNode | null>(() => editor.getSelectedNode() ?? null)
  const { missingFonts, hasMissingFonts } = useNodeFontStatus(() => node.value)
  const fontFamily = computed(() => node.value?.fontFamily ?? '')
  const fontWeight = computed(() => node.value?.fontWeight ?? 400)
  const fontSize = computed(() => node.value?.fontSize ?? 16)
  const currentWeightLabel = computed(
    () => FONT_WEIGHT_NAMES[node.value?.fontWeight ?? 400] ?? 'Regular'
  )
  const activeFormatting = computed(() => {
    const n = node.value
    if (!n) return []
    const result: string[] = []
    if (n.fontWeight >= 700) result.push('bold')
    if (n.italic) result.push('italic')
    if (n.textDecoration === 'UNDERLINE') result.push('underline')
    if (n.textDecoration === 'STRIKETHROUGH') result.push('strikethrough')
    return result
  })

  return {
    node,
    fontFamily,
    fontWeight,
    fontSize,
    currentWeightLabel,
    activeFormatting,
    missingFonts,
    hasMissingFonts
  }
}

type TypographyActionOptions = {
  editor: Editor
  node: ComputedRef<SceneNode | null>
  currentWeightLabel: ComputedRef<string>
  activeFormatting: ComputedRef<string[]>
  options: UseTypographyOptions
}

export function createTypographyActions({
  editor,
  node,
  activeFormatting,
  options
}: TypographyActionOptions) {
  let propBeforePreview:
    | { key: keyof SceneNode; value: SceneNode[keyof SceneNode]; textStyleId: string | null }
    | undefined

  async function setFont(
    changes: Partial<Pick<SceneNode, 'fontFamily' | 'fontWeight' | 'italic'>>,
    label: string
  ) {
    const target = node.value
    if (!target) return
    const graph = editor.graph
    const id = target.id
    const next = {
      fontFamily: target.fontFamily,
      fontWeight: target.fontWeight,
      italic: target.italic,
      ...changes
    }
    const styles = options.fontLoader?.styles?.(next.fontFamily) ?? []
    if (
      styles.length > 0 &&
      !styles.some((style) => {
        const face = parseFontStyle(style)
        return face.weight === next.fontWeight && face.italic === next.italic
      })
    )
      return
    const loading = options.fontLoader?.load(
      next.fontFamily,
      weightToStyle(next.fontWeight, next.italic),
      target.text
    )
    editor.updateNodeWithUndo(id, changes, label)
    // Completion only repaints. It must not undo a newer choice or target another selection.
    try {
      await loading
    } finally {
      if (editor.graph === graph && graph.getNode(id) === target) editor.requestRender()
    }
  }

  async function setFamily(family: string) {
    const target = node.value
    if (!target) return
    const styles = options.fontLoader?.styles?.(family) ?? []
    const nearest = styles
      .map(parseFontStyle)
      .sort(
        (a, b) =>
          Number(a.italic !== target.italic) - Number(b.italic !== target.italic) ||
          Math.abs(a.weight - target.fontWeight) - Math.abs(b.weight - target.fontWeight) ||
          a.weight - b.weight
      )
      .at(0)
    if (nearest) {
      return setFont(
        { fontFamily: family, fontWeight: nearest.weight, italic: nearest.italic },
        'Change font'
      )
    }
    return setFont({ fontFamily: family }, 'Change font')
  }

  function setWeight(weight: number) {
    return setFont({ fontWeight: weight }, 'Change font weight')
  }

  function setAlign(align: TextAlign) {
    if (!node.value) return
    editor.updateNodeWithUndo(
      node.value.id,
      { textAlignHorizontal: align },
      'Change text alignment'
    )
  }

  function setDirection(direction: TextDirection) {
    if (!node.value) return
    editor.updateNodeWithUndo(node.value.id, { textDirection: direction }, 'Change text direction')
  }

  function setVerticalAlign(align: TextVerticalAlign) {
    if (!node.value) return
    editor.updateNodeWithUndo(
      node.value.id,
      { textAlignVertical: align },
      'Change vertical text alignment'
    )
  }

  function setTextCase(textCase: TextCase) {
    if (!node.value) return
    editor.updateNodeWithUndo(node.value.id, { textCase }, 'Change text case')
  }

  function setTruncation(textTruncation: TextTruncation) {
    if (!node.value) return
    editor.updateNodeWithUndo(node.value.id, { textTruncation }, 'Change text truncation')
  }

  function setFontFeature(tag: string, enabled: boolean) {
    if (!node.value) return
    const fontFeatures = node.value.fontFeatures.filter((feature) => feature.tag !== tag)
    fontFeatures.push({ tag, enabled })
    editor.updateNodeWithUndo(node.value.id, { fontFeatures }, `Change ${tag} feature`)
  }

  function toggleBold() {
    if (!node.value) return
    void setWeight(node.value.fontWeight >= 700 ? 400 : 700)
  }

  function toggleItalic() {
    if (!node.value) return
    void setFont({ italic: !node.value.italic }, 'Toggle italic')
  }

  function toggleDecoration(deco: 'UNDERLINE' | 'STRIKETHROUGH') {
    if (!node.value) return
    const current = node.value.textDecoration
    editor.updateNodeWithUndo(
      node.value.id,
      { textDecoration: (current === deco ? 'NONE' : deco) as TextDecoration },
      `Toggle ${deco.toLowerCase()}`
    )
  }

  function onFormattingChange(values: string[]) {
    if (!node.value) return
    const prev = activeFormatting.value
    const added = values.filter((v) => !prev.includes(v))
    const removed = prev.filter((v) => !values.includes(v))
    for (const item of [...added, ...removed]) {
      if (item === 'bold') toggleBold()
      else if (item === 'italic') toggleItalic()
      else if (item === 'underline') toggleDecoration('UNDERLINE')
      else if (item === 'strikethrough') toggleDecoration('STRIKETHROUGH')
    }
  }

  function updateProp(key: keyof SceneNode, value: number | string | null) {
    if (!node.value) return
    if (!propBeforePreview || propBeforePreview.key !== key) {
      propBeforePreview = {
        key,
        value: node.value[key],
        textStyleId: node.value.textStyleId
      }
    }
    editor.updateNode(node.value.id, { [key]: value } as Partial<SceneNode>)
  }

  function commitProp(
    key: keyof SceneNode,
    _value: number | string | null,
    previous: number | string | null
  ) {
    if (!node.value) return
    const snapshot = propBeforePreview?.key === key ? propBeforePreview : undefined
    editor.commitNodeUpdate(
      node.value.id,
      {
        [key]: snapshot ? snapshot.value : previous,
        ...(snapshot ? { textStyleId: snapshot.textStyleId } : {})
      } as Partial<SceneNode>,
      `Change ${String(key)}`
    )
    propBeforePreview = undefined
  }

  return {
    setFamily,
    setWeight,
    setAlign,
    setDirection,
    setVerticalAlign,
    setTextCase,
    setTruncation,
    setFontFeature,
    toggleBold,
    toggleItalic,
    toggleDecoration,
    onFormattingChange,
    updateProp,
    commitProp
  }
}
