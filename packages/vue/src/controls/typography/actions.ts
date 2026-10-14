import { omit } from 'es-toolkit/object'
import { computed } from 'vue'
import type { ComputedRef } from 'vue'

import type { Editor } from '@open-pencil/core/editor'
import { FONT_WEIGHT_NAMES, fontManager, weightToStyle } from '@open-pencil/core/text'
import { parseFontStyle } from '@open-pencil/scene-graph'
import type {
  SceneNode,
  TextDecoration,
  TextListType,
  TextParagraphSpacingField
} from '@open-pencil/scene-graph'

import {
  createTextListActions,
  listTypeOf,
  paragraphSpacingChanges,
  paragraphSpacingOf
} from '#vue/canvas/text-edit/paragraphs'
import { useNodePreview } from '#vue/controls/node-preview/use'
import { MIXED, type MixedValue } from '#vue/controls/node-props/use'
import { useFamilyFaces } from '#vue/controls/typography/faces'
import type { UseTypographyOptions } from '#vue/controls/typography/use'
import { selectedNodesAsShown } from '#vue/editor/selection-state/nodes'
import { useSceneComputed } from '#vue/internal/scene-computed/use'
import { useNodeFontStatus } from '#vue/shared/font-status/use'

type TextAlign = SceneNode['textAlignHorizontal']
type TextDirection = SceneNode['textDirection']
type TextVerticalAlign = SceneNode['textAlignVertical']
type TextCase = SceneNode['textCase']
type TextTruncation = SceneNode['textTruncation']

function sharedValue<T>(values: readonly T[]): MixedValue<T> {
  const [first] = values
  return values.every((value) => value === first) ? first : MIXED
}

/** The formatting every node has, so a mixed toggle reads as off. */
function sharedFormatting(nodes: readonly SceneNode[]) {
  if (nodes.length === 0) return []
  const result: string[] = []
  if (nodes.every((n) => n.fontWeight >= 700)) result.push('bold')
  if (nodes.every((n) => n.italic)) result.push('italic')
  if (nodes.every((n) => n.textDecoration === 'UNDERLINE')) result.push('underline')
  if (nodes.every((n) => n.textDecoration === 'STRIKETHROUGH')) result.push('strikethrough')
  return result
}

/**
 * Typography of the selected text layers. With other layers selected too, Figma shows the text's
 * typography and edits only the text, so `nodes` holds just the text layers.
 */
export function createTypographyState(editor: Editor) {
  const nodes = useSceneComputed<SceneNode[]>(() =>
    selectedNodesAsShown(editor).filter((n) => n.type === 'TEXT')
  )
  const node = computed<SceneNode | null>(() => nodes.value.at(0) ?? null)
  const { missingFonts, hasMissingFonts } = useNodeFontStatus(() => node.value)
  const fontFamily = computed(() => node.value?.fontFamily ?? '')
  const fontWeight = computed(() => node.value?.fontWeight ?? 400)
  const fontSize = computed(() => node.value?.fontSize ?? 16)
  const currentWeightLabel = computed(
    () => FONT_WEIGHT_NAMES[node.value?.fontWeight ?? 400] ?? 'Regular'
  )
  const activeFormatting = computed(() => sharedFormatting(nodes.value))
  const { weights, supports } = useFamilyFaces(nodes)
  /**
   * The list style every selected text shares, or that of the paragraphs being edited; `null`
   * when they differ.
   */
  const listType = computed(() => {
    void editor.state.textSelectionVersion
    const shared = sharedValue(nodes.value.map((n) => listTypeOf(editor, n)))
    return shared === MIXED ? null : shared
  })

  /** The value every selected text layer shares, or MIXED when they differ. */
  function merged<K extends keyof SceneNode>(key: K): MixedValue<SceneNode[K]> {
    return sharedValue(nodes.value.map((n) => n[key]))
  }

  /** A spacing every paragraph changes apply to shares, or MIXED when they differ. */
  function paragraphSpacing(field: TextParagraphSpacingField): MixedValue<number> {
    void editor.state.textSelectionVersion
    const values = nodes.value.map((n) => paragraphSpacingOf(editor, n, field))
    const shared = sharedValue(values)
    return shared === null ? MIXED : shared
  }

  /** Whether one OpenType feature is on for every text layer, MIXED when they differ. */
  function fontFeature(tag: string): MixedValue<boolean> {
    return sharedValue(
      nodes.value.map((n) => n.fontFeatures.find((feature) => feature.tag === tag)?.enabled ?? true)
    )
  }

  return {
    node,
    nodes,
    merged,
    paragraphSpacing,
    fontFeature,
    fontFamily,
    fontWeight,
    fontSize,
    currentWeightLabel,
    activeFormatting,
    listType,
    weights,
    supports,
    missingFonts,
    hasMissingFonts
  }
}

type TypographyActionOptions = {
  editor: Editor
  nodes: ComputedRef<SceneNode[]>
  activeFormatting: ComputedRef<string[]>
  /** Whether a layer's family has a face; true when nothing says it has not. */
  supports: (node: SceneNode, weight: number, italic: boolean) => boolean
  options: UseTypographyOptions
}

export function createTypographyActions({
  editor,
  nodes,
  activeFormatting,
  supports,
  options
}: TypographyActionOptions) {
  const lists = createTextListActions(editor)
  const preview = useNodePreview(editor)

  /** Applies one change per text layer in one undo step. */
  function updateEach(
    label: string,
    changes: (node: SceneNode) => Partial<SceneNode>,
    targets = nodes.value
  ) {
    if (targets.length === 0) return
    editor.undo.runBatch(label, () => {
      for (const target of targets) editor.updateNodeWithUndo(target.id, changes(target), label)
    })
  }

  function update(label: string, changes: Partial<SceneNode>) {
    updateEach(label, () => changes)
  }

  type FontChanges = Partial<Pick<SceneNode, 'fontFamily' | 'fontWeight' | 'italic'>>
  async function setFont(
    changes: FontChanges | ((target: SceneNode) => FontChanges),
    label: string,
    selected = nodes.value
  ) {
    const graph = editor.graph
    const updates = selected.map((target) => {
      const patch = typeof changes === 'function' ? changes(target) : changes
      const changedFields = Object.keys(patch)
      if (patch.fontFamily !== undefined) changedFields.push('fontWeight', 'fontStyle')
      const bindings = omit(target.boundVariables, changedFields)
      const scales = omit(target.variableBindingScales, changedFields)
      return {
        target,
        patch: { ...patch, boundVariables: bindings, variableBindingScales: scales },
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
        const styles =
          options.fontLoader?.styles?.(next.fontFamily) ?? fontManager.familyStyles(next.fontFamily)
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
      const nearest = (options.fontLoader?.styles?.(family) ?? fontManager.familyStyles(family))
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
  function setWeight(weight: number, selected = nodes.value) {
    return setFont({ fontWeight: weight }, 'Change font weight', selected)
  }
  function setAlign(align: TextAlign) {
    update('Change text alignment', { textAlignHorizontal: align })
  }

  function setDirection(direction: TextDirection) {
    update('Change text direction', { textDirection: direction })
  }

  function setVerticalAlign(align: TextVerticalAlign) {
    update('Change vertical text alignment', { textAlignVertical: align })
  }

  function setTextCase(textCase: TextCase) {
    update('Change text case', { textCase })
  }

  function setTruncation(textTruncation: TextTruncation) {
    update('Change text truncation', { textTruncation })
  }

  function setFontFeature(tag: string, enabled: boolean) {
    updateEach(`Change ${tag} feature`, (target) => ({
      fontFeatures: [
        ...target.fontFeatures.filter((feature) => feature.tag !== tag),
        { tag, enabled }
      ]
    }))
  }

  function setListType(listType: TextListType) {
    const targets = nodes.value
    if (targets.length === 0) return
    editor.undo.runBatch('Change list style', () => {
      for (const target of targets) lists.setListType(target, listType)
    })
  }

  type SpacingPreview = Pick<SceneNode, TextParagraphSpacingField | 'textParagraphs'>
  let spacingPreviewField: TextParagraphSpacingField | undefined
  const beforeSpacing = new Map<string, SpacingPreview>()

  function previewParagraphSpacing(field: TextParagraphSpacingField, value: number) {
    if (spacingPreviewField !== field) {
      restoreSpacingPreview()
      spacingPreviewField = field
    }
    for (const target of nodes.value) {
      if (!beforeSpacing.has(target.id)) {
        const { listSpacing, paragraphSpacing, paragraphIndent, textParagraphs } = target
        beforeSpacing.set(target.id, {
          listSpacing,
          paragraphSpacing,
          paragraphIndent,
          textParagraphs
        })
      }
      editor.updateNode(target.id, paragraphSpacingChanges(editor, target, field, value))
    }
    editor.requestRender()
  }

  function restoreSpacingPreview() {
    for (const [id, before] of beforeSpacing) editor.updateNode(id, before)
    beforeSpacing.clear()
    spacingPreviewField = undefined
  }

  /**
   * Sets a spacing for the paragraphs being edited, or for whole text layers, in one undo step;
   * while text is edited the change is a step of its own after what was typed.
   */
  function setParagraphSpacing(field: TextParagraphSpacingField, value: number) {
    restoreSpacingPreview()
    const targets = nodes.value
    if (targets.length === 0) return
    const label = `Change ${field}`
    editor.runTextEditStep(() => {
      editor.undo.runBatch(label, () => {
        for (const target of targets) {
          const current = editor.graph.getNode(target.id) ?? target
          editor.updateNodeWithUndo(
            target.id,
            paragraphSpacingChanges(editor, current, field, value),
            label
          )
        }
      })
    })
    editor.requestRender()
  }

  function setHangingList(hangingList: boolean) {
    update('Change hanging lists', { hangingList })
  }

  /**
   * Bold unless every text layer already is, as Figma's toggle does for a mixed selection. A layer
   * whose family has no such face is left alone, as Figma leaves it.
   */
  function toggleBold() {
    const weight = activeFormatting.value.includes('bold') ? 400 : 700
    void setWeight(
      weight,
      nodes.value.filter((target) => supports(target, weight, target.italic))
    )
  }

  function toggleItalic() {
    const italic = !activeFormatting.value.includes('italic')
    void setFont(
      { italic },
      'Toggle italic',
      nodes.value.filter((target) => supports(target, target.fontWeight, italic))
    )
  }

  function toggleDecoration(deco: 'UNDERLINE' | 'STRIKETHROUGH') {
    const on = activeFormatting.value.includes(deco.toLowerCase())
    update(`Toggle ${deco.toLowerCase()}`, {
      textDecoration: (on ? 'NONE' : deco) as TextDecoration
    })
  }

  function onFormattingChange(values: string[]) {
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
      nodes.value.map((target) => target.id),
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
    setWeight,
    setAlign,
    setDirection,
    setVerticalAlign,
    setTextCase,
    setTruncation,
    setFontFeature,
    setListType,
    previewParagraphSpacing,
    setParagraphSpacing,
    setHangingList,
    toggleBold,
    toggleItalic,
    toggleDecoration,
    onFormattingChange,
    updateProp,
    commitProp
  }
}
