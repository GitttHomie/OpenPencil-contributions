---
title: useSelectionLayout
description: Shared layout capabilities, sizing, and row or column spacing for the selected layers.
---

# useSelectionLayout

`useSelectionLayout()` reads and edits the layout capabilities shared by every selected layer.
The inspector uses the same controls for a single layer and a multi-selection, showing a control
only when all selected layers support it.

- `allText`, `allContainers`, `allAutoLayout`, `allFlex`, and `allGrid` identify shared capabilities.
- `merged(property)` returns the common property value, or `MIXED` when values differ.
- `sizing(axis)` and `sizingOptions` expose compatible width and height sizing.
- `spacing` and `spacingAxis` describe the gaps when the layers form one row or column.

Layout and sizing actions apply to the selection in one undo step. Generic property updates
use `updateAllWithUndo`; check the relevant capability before exposing them.

## Usage

```ts
import { useSelectionLayout } from '@open-pencil/vue'

const layout = useSelectionLayout()

if (layout.allText.value) {
  layout.updateAllWithUndo({ textAutoResize: 'HEIGHT' }, 'Set text resizing')
}
if (layout.allContainers.value) layout.setMode('VERTICAL')
layout.setSizing('width', 'FIXED')
if (layout.spacingAxis.value) {
  layout.setSpacing(16)
  layout.flushSpacing()
}
```

`setSpacing` keeps the first layer of the row in place and spaces the rest after it. Call
`flushSpacing` when an interaction commits; successive scrub updates share one undo step.

## Related APIs

- [useLayout](./use-layout)
- [useSelectionColors](./use-selection-colors)
