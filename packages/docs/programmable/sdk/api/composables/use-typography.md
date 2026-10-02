---
title: useTypography
description: Read and update font, alignment, case, truncation, and OpenType features for text nodes.
---

# useTypography

`useTypography()` is the text-property control composable for text editing panels.

It exposes:

- font family
- font weight
- font size
- formatting state
- missing-font status
- horizontal and vertical alignment, including justification
- text case and direction
- ending truncation and maximum lines
- OpenType feature toggles
- helpers for changing family, weight, alignment, and decorations

## Usage

```ts
import { useTypography } from '@open-pencil/vue'

const typography = useTypography()
```

## Basic example

```ts
const {
  fontFamily,
  fontWeight,
  fontSize,
  activeFormatting,
  setFamily,
  setWeight,
  setAlign,
  setVerticalAlign,
  setTextCase,
  setTruncation,
  setFontFeature,
} = useTypography()
```

## Practical examples

### Load and switch a font family

The loader receives the family, canonical style (including italic), and the node's text for glyph coverage.
Family and weight changes commit immediately; loading completion only requests a repaint, so it cannot overwrite a later choice or Undo. Hosts can provide a synchronous `styles(family)` callback with available styles and an optional `loadStyles(family)` callback to populate metadata. Family selection chooses the nearest available weight, preferring the current italic style. The `weights` array and `canToggleBold` / `canToggleItalic` flags follow that catalog and refresh after metadata loads. An empty catalog preserves the requested style.

```ts
const typography = useTypography({
  fontLoader: {
    load: async (family, style) => {
      await myFontLoader(family, style)
    },
  },
})
```

### Toggle formatting

```ts
typography.toggleBold()
typography.toggleItalic()
typography.toggleDecoration('UNDERLINE')
typography.setTextCase('UPPER')
typography.setVerticalAlign('CENTER')
typography.setTruncation('ENDING')
typography.setFontFeature('LIGA', false)
```

## Related APIs

- [useTextEdit](./use-text-edit)
- [useSelectionState](./use-selection-state)
