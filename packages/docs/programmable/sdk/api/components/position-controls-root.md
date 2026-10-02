---
title: PositionControlsRoot
description: Headless root primitive for position, size, alignment, and transform controls.
---

# PositionControlsRoot

`PositionControlsRoot` exposes position, size, rotation, align, flip, and rotate handlers for the current selection.

Use it when you want custom position controls without reimplementing editor wiring.

The slot exposes `canPosition`, `canExclude`, and `excluded` for dynamic controls.
Disable X/Y and manual alignment when `canPosition` is false. Show an exclusion
checkbox when `canExclude` is true, bind its state to `excluded`, and call
`actions.setExcluded(boolean)` when it changes.

## Related APIs

- [usePosition](../composables/use-position)
- [Property Panels guide](../../guides/property-panels)
