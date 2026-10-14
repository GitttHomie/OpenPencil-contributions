import type { Paint, ParagraphBuilder, TextStyle } from 'canvaskit-wasm'

export interface ParagraphBuildOptions {
  halfLeading?: boolean
  foregroundPaint?: Paint
  /** Resolved width for drawing or export; omit when measuring intrinsic Hug text. */
  layoutWidth?: number
}

export interface ParagraphPaintStyle {
  foreground: Paint
  background: Paint
}

export function pushParagraphStyle(
  builder: ParagraphBuilder,
  style: TextStyle,
  paints?: ParagraphPaintStyle
): void {
  if (paints) builder.pushPaintStyle(style, paints.foreground, paints.background)
  else builder.pushStyle(style)
}
