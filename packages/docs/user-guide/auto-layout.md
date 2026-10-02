---
title: Auto Layout
description: Flex and grid layout in OpenPencil — direction, gap, padding, alignment, child sizing, and CSS Grid tracks.
---

# Auto Layout

Auto layout positions children automatically within a frame. It supports two modes: **flex** (horizontal/vertical flow) and **grid** (rows and columns with track sizing).
## Enabling Auto Layout

- Select a frame and press <kbd>⇧</kbd><kbd>A</kbd> (<kbd>Shift</kbd> + <kbd>A</kbd>) to toggle auto layout on or off
- Select loose nodes (without a parent frame) and press <kbd>⇧</kbd><kbd>A</kbd> to wrap them in a new auto-layout frame

When wrapping a selection, nodes are sorted by visual position: left-to-right for horizontal layout, top-to-bottom for vertical.

## Layout Direction

Choose how children are arranged:

- **Horizontal** — children flow left to right
- **Vertical** — children flow top to bottom
- **Wrap** — children wrap to the next row/column when they run out of space

## Spacing

### Gap

The space between adjacent children. Set a single value that applies between all children.

### Padding

The space between the frame edge and its children. Set a uniform value for all sides, or expand to set each side independently (top, right, bottom, left).

## Alignment

### Justify (main axis)

Controls how children are distributed along the layout direction:

- **Start** — children pack to the beginning
- **Center** — children are centered
- **End** — children pack to the end
- **Space between** — children spread with equal space between them

### Align (cross axis)

Controls how children are positioned perpendicular to the layout direction:

- **Start** — children align to the start
- **Center** — children are centered
- **End** — children align to the end
- **Stretch** — children stretch to fill the cross axis

## Child Sizing

Each child in an auto-layout frame can have its own sizing mode:

- **Fixed** — uses the child's explicit width/height
- **Fill** — stretches to fill available space in the parent
- **Hug** — shrinks to fit the child's content

Choosing Fill on a child switches the parent's corresponding Hug axis to Fixed at its current size. Choosing Hug on a parent switches filling children on that axis to Fixed. This avoids a circular dependency between the parent and child sizes; each sizing change and its automatic adjustments undo together.

When adding auto layout to a reopened or imported frame, children enter the new flow instead of keeping their stored positions. Their free-positioning constraints remain saved and become available again if auto layout is removed or the child is excluded.

## Excluding Children

Select a child and enable **Exclude from auto layout** in the Position section. The child stays inside its parent at its current position and size, but no longer participates in flow spacing or the parent's Hug size. Fill dimensions become Fixed; the child's own Hug layout remains available. Disable the checkbox to return it to the flow at its layer-order position. Each change can be undone in one step.

For children in the flow, X/Y show the calculated position and are disabled, along with manual alignment buttons. Excluded children have editable X/Y, manual alignment, and constraints. Constraints also appear for children of frames without auto layout; they do not appear for top-level canvas objects. These controls depend on the immediate parent, independently of the selected frame's own layout.

Constraints on excluded children also follow layout-driven size changes. For example, a badge with Right and Top constraints keeps its offsets, including overhang outside the frame, when a Hug button grows or shrinks as you edit its label.

For mixed selections, position editing is disabled if any selected child is in the flow. The exclusion checkbox appears when all selected nodes have auto-layout parents, and shows a mixed state when only some are excluded.

## Drag Reordering

Within an auto-layout frame, drag a child to reorder it among its siblings. A visual insertion indicator shows where the child will be dropped.

Drag multiple selected children to move them as an ordered block. Move the pointer outside the frame to pull them out, or onto another frame to transfer them. The old and new layouts update on release, and Undo restores the original order and parent.

Arrow keys reorder children in the layout direction: left/right for horizontal layouts and up/down for vertical layouts. Right-to-left rows follow their visual direction. Shift still moves one slot; it moves 10 pixels only for freely positioned objects. In a grid, left/right moves one position and up/down moves by the configured column count. Absolute-positioned children move freely instead of reordering.

## Properties Panel

When an auto-layout frame is selected, the Layout section in the properties panel shows all auto-layout controls: direction, gap, padding, justify, and align.

## Keyboard Shortcuts

| Action | Mac | Windows / Linux |
|--------|-----|-----------------|
| Toggle auto layout | <kbd>⇧</kbd><kbd>A</kbd> | <kbd>Shift</kbd> + <kbd>A</kbd> |

## CSS Grid

Grid layout arranges children in rows and columns with explicit track sizing.

### Enabling Grid

Select a frame with auto layout enabled and click the grid icon in the layout toolbar to switch from flex to grid.

### Track Sizing

Define column and row tracks with three sizing modes:

- **fr** — fractional unit, divides available space proportionally
- **px** — fixed pixel size
- **auto** — sizes to fit content

Example: three columns of `1fr 200px 1fr` creates a layout with a fixed center column and flexible sides.

### Grid Gaps

Set separate horizontal (column) and vertical (row) gaps between cells.

### Child Positioning

Children are placed into grid cells automatically in row order. You can override placement with column/row start and span values in the child's layout properties.

### JSX and Tailwind Export

Grid layouts export to JSX with Tailwind classes: `grid grid-cols-3`, `gap-x-4 gap-y-2`, `col-start-2 row-span-2`.

## Tips

- Auto layout recomputes immediately after creation, so the selection bounds update right away.
- Nest auto-layout frames for complex responsive layouts (e.g., a vertical frame containing horizontal rows).
- Use "Fill" sizing to make a child take up remaining space, like a flex-grow: 1 in CSS.
- Use grid for dashboard layouts, galleries, and forms — anything with a two-dimensional structure.
- See [Drawing Shapes](./drawing-shapes) for creating the frames that auto layout applies to.
- See [Components](./components) for using auto layout within reusable components.
