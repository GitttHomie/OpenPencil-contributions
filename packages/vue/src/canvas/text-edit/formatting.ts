import type { Editor } from '@open-pencil/core/editor'
import {
  collectNodeFontFaces,
  fontManager,
  toggleBoldInRange,
  toggleDecorationInRange,
  toggleItalicInRange
} from '@open-pencil/core/text'
import { parseFontStyle, weightToStyle } from '@open-pencil/scene-graph'
import type { SceneNode } from '@open-pencil/scene-graph'

export function createTextFormattingActions(store: Editor) {
  function applyFormatting(nodeId: string, changes: Partial<SceneNode>, label: string) {
    const node = store.graph.getNode(nodeId)
    if (!node) return
    const previous = new Set(
      collectNodeFontFaces(node).map((face) => `${face.family}|${face.style}`)
    )
    const unsupported = collectNodeFontFaces({ ...node, ...changes }).some((face) => {
      if (previous.has(`${face.family}|${face.style}`)) return false
      const styles = fontManager.familyStyles(face.family)
      return (
        styles.length > 0 &&
        !styles.some((style) => {
          const parsed = parseFontStyle(style)
          return weightToStyle(parsed.weight, parsed.italic) === face.style
        })
      )
    })
    if (unsupported) return
    store.updateNodeWithUndo(nodeId, changes, label)
    const updated = store.graph.getNode(nodeId)
    if (updated) store.textEditor?.rebuildParagraph(updated)
    store.requestRender()
  }

  function toggleBold(node: SceneNode) {
    const editor = store.textEditor
    const range = editor?.getSelectionRange()
    if (range) {
      const { runs } = toggleBoldInRange(
        node.styleRuns,
        range[0],
        range[1],
        node.fontWeight,
        node.text.length
      )
      applyFormatting(node.id, { styleRuns: runs }, 'Toggle bold')
    } else {
      applyFormatting(node.id, { fontWeight: node.fontWeight >= 700 ? 400 : 700 }, 'Toggle bold')
    }
  }

  function toggleItalic(node: SceneNode) {
    const editor = store.textEditor
    const range = editor?.getSelectionRange()
    if (range) {
      const { runs } = toggleItalicInRange(
        node.styleRuns,
        range[0],
        range[1],
        node.italic,
        node.text.length
      )
      applyFormatting(node.id, { styleRuns: runs }, 'Toggle italic')
    } else {
      applyFormatting(node.id, { italic: !node.italic }, 'Toggle italic')
    }
  }

  function toggleUnderline(node: SceneNode) {
    const editor = store.textEditor
    const range = editor?.getSelectionRange()
    if (range) {
      const { runs } = toggleDecorationInRange(
        node.styleRuns,
        range[0],
        range[1],
        'UNDERLINE',
        node.textDecoration,
        node.text.length
      )
      applyFormatting(node.id, { styleRuns: runs }, 'Toggle underline')
    } else {
      applyFormatting(
        node.id,
        { textDecoration: node.textDecoration === 'UNDERLINE' ? 'NONE' : 'UNDERLINE' },
        'Toggle underline'
      )
    }
  }

  return { toggleBold, toggleItalic, toggleUnderline }
}
