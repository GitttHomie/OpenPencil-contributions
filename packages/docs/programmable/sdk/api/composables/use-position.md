---
title: usePosition
description: Read and update selected node position, size, rotation, alignment, and flipping.
---

# usePosition

`usePosition()` is a control composable for position-related UI.

It exposes selected-node values like:

- `x`
- `y`
- `width`
- `height`
- `rotation`

and actions like:

- align
- flip
- rotate
- scrub/update numeric properties

## Usage

`canPosition` indicates whether every selected node can be positioned freely.
`canExclude` indicates whether all selected nodes have auto-layout parents.
`excluded` is `true`, `false`, or `'indeterminate'` for mixed positioning.
Call `setExcluded(boolean)` to change the selection's participation in one undo step.
Position eligibility updates when the parent layout changes; in-flow X/Y updates and manual alignment are ignored.

Excluded children follow their constraints when Hug or Fill changes their parent's size. Custom layout implementations can use `constrainedChildRect` from `@open-pencil/scene-graph/resize`; its optional sixth argument, `roundToPixels`, defaults to `true`. Pass `false` to retain fractional positions and sizes during repeated layout passes.

```ts
import { usePosition } from '@open-pencil/vue'

const position = usePosition()
```

## Basic example

```ts
const { x, y, width, height, rotation, updateProp, commitProp } = usePosition()
```

## Practical examples

### Align selected nodes

```ts
position.align('horizontal', 'center')
position.align('vertical', 'min')
```

### Flip selection

```ts
position.flip('horizontal')
position.flip('vertical')
```

### Rotate selection

```ts
position.rotate(90)
```

## Related APIs

- [useLayout](./use-layout)
- [useAppearance](./use-appearance)
