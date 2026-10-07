import { createTypographyActions, createTypographyState } from '#vue/controls/typography/actions'
import { useFontStyleOptions } from '#vue/controls/typography/styles'
import { useEditor } from '#vue/editor/context'

/**
 * Options for {@link useTypography}.
 */
export interface TypographyFontLoader {
  load: (family: string, style: string, characters?: string) => Promise<unknown>
  /** Available styles from the host's local or online catalog. */
  styles?: (family: string) => readonly string[]
  /** Populate style metadata without downloading font files. */
  loadStyles?: (family: string) => Promise<void>
}

export interface UseTypographyOptions {
  /**
   * Optional font loader started when changing family or weight.
   */
  fontLoader?: TypographyFontLoader
}

/**
 * Returns typography-related state and actions for the current text selection.
 *
 * This composable is designed for text property panels and formatting controls.
 */
export function useTypography(options: UseTypographyOptions = {}) {
  const editor = useEditor()
  const typographyState = createTypographyState(editor)
  const actions = createTypographyActions({ editor, ...typographyState, options })
  const styleOptions = useFontStyleOptions(
    typographyState.node,
    options.fontLoader,
    typographyState.nodes
  )

  return {
    editor,
    ...typographyState,
    get weights() {
      return styleOptions.weights.value
    },
    get canToggleBold() {
      return styleOptions.canToggleBold.value
    },
    get canToggleItalic() {
      return styleOptions.canToggleItalic.value
    },
    ...actions
  }
}
