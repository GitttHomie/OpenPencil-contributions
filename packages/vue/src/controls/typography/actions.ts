import { computed } from 'vue'
import type { ComputedRef } from 'vue'

import type { Editor } from '@open-pencil/core/editor'
import { FONT_WEIGHT_NAMES, weightToStyle } from '@open-pencil/core/text'
import { parseFontStyle } from '@open-pencil/scene-graph'
import type { SceneNode } from '@open-pencil/scene-graph'

import { useNodePreview } from '#vue/controls/node-preview/use'
import { createNodePropSelectionState } from '#vue/controls/node-props/helpers'
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
  const selection = createNodePropSelectionState(editor)
  const nodes = computed(() =>
    selection.nodes.value.every((node) => node.type === 'TEXT') ? selection.nodes.value : []
  )
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
    nodes,
    merged: selection.merged,
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
  nodes?: ComputedRef<SceneNode[]>
  currentWeightLabel: ComputedRef<string>
  activeFormatting: ComputedRef<string[]>
  options: UseTypographyOptions
}

export function createTypographyActions({
  editor,
  node,
  nodes,
  activeFormatting,
  options
}: TypographyActionOptions) {
  const preview = useNodePreview(editor)

  const targets = () => nodes?.value ?? (node.value ? [node.value] : [])
  function apply(
    patch: Partial<SceneNode> | ((target: SceneNode) => Partial<SceneNode>),
    label: string
  ) {
    const selected = [...targets()]
    editor.undo.runBatch(label, () => {
      for (const target of selected)
        editor.updateNodeWithUndo(
          target.id,
          typeof patch === 'function' ? patch(target) : patch,
          label
        )
    })
  }

  type FontChanges = Partial<Pick<SceneNode, 'fontFamily' | 'fontWeight' | 'italic'>>
  async function setFont(
    changes: FontChanges | ((target: SceneNode) => FontChanges),
    label: string
  ) {
    const graph = editor.graph
    const updates = targets().map((target) => {
      const patch = typeof changes === 'function' ? changes(target) : changes
      return {
        target,
        patch,
        next: {
          fontFamily: target.fontFamily,
          fontWeight: target.fontWeight,
          italic: target.italic,
          ...patch
        }
      }
    })
    if (
      updates.some(({ next }) => {
        const styles = options.fontLoader?.styles?.(next.fontFamily) ?? []
        return (
          styles.length > 0 &&
          !styles.some((style) => {
            const face = parseFontStyle(style)
            return face.weight === next.fontWeight && face.italic === next.italic
          })
        )
      })
    )
      return
    const loading = updates.map(({ target, next }) =>
      options.fontLoader?.load(
        next.fontFamily,
        weightToStyle(next.fontWeight, next.italic),
        target.text
      )
    )
    editor.undo.runBatch(label, () => {
      for (const { target, patch } of updates) editor.updateNodeWithUndo(target.id, patch, label)
    })
    try {
      await Promise.all(loading)
    } finally {
      if (editor.graph === graph) editor.requestRender()
    }
  }

  function setFamily(family: string) {
    return setFont((target) => {
      const nearest = (options.fontLoader?.styles?.(family) ?? [])
        .map(parseFontStyle)
        .sort(
          (a, b) =>
            Number(a.italic !== target.italic) - Number(b.italic !== target.italic) ||
            Math.abs(a.weight - target.fontWeight) - Math.abs(b.weight - target.fontWeight) ||
            a.weight - b.weight
        )
        .at(0)
      return nearest
        ? { fontFamily: family, fontWeight: nearest.weight, italic: nearest.italic }
        : { fontFamily: family }
    }, 'Change font')
  }
  function setWeight(weight: number) {
    return setFont({ fontWeight: weight }, 'Change font weight')
  }
  function setAlign(align: TextAlign) {
    apply({ textAlignHorizontal: align }, 'Change text alignment')
  }
  function setDirection(direction: TextDirection) {
    apply({ textDirection: direction }, 'Change text direction')
  }
  function setVerticalAlign(align: TextVerticalAlign) {
    apply({ textAlignVertical: align }, 'Change vertical text alignment')
  }
  function setTextCase(textCase: TextCase) {
    apply({ textCase }, 'Change text case')
  }
  function setTruncation(textTruncation: TextTruncation) {
    apply({ textTruncation }, 'Change text truncation')
  }
  function setFontFeature(tag: string, enabled: boolean) {
    apply(
      (target) => ({
        fontFeatures: [
          ...target.fontFeatures.filter((feature) => feature.tag !== tag),
          { tag, enabled }
        ]
      }),
      `Change ${tag} feature`
    )
  }
  function setItalic(italic: boolean) {
    return setFont({ italic }, 'Change italic')
  }
  function toggleBold() {
    void setWeight(targets().every((target) => target.fontWeight >= 700) ? 400 : 700)
  }

  function toggleItalic() {
    void setItalic(!targets().every((target) => target.italic))
  }

  function toggleDecoration(deco: 'UNDERLINE' | 'STRIKETHROUGH') {
    const current = targets().every((target) => target.textDecoration === deco)
    apply({ textDecoration: current ? 'NONE' : deco }, `Toggle ${deco.toLowerCase()}`)
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
    preview.update(
      targets().map((target) => target.id),
      { [key]: value },
      `Change ${String(key)}`
    )
  }

  function commitProp(
    _key: keyof SceneNode,
    _value: number | string | null,
    _previous: number | string | null
  ) {
    preview.commit()
  }

  return {
    setFamily,
    setItalic,
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
    cancelProp: preview.cancel,
    commitProp
  }
}
