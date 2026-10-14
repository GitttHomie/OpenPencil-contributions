---
title: Selection & Manipulation
description: Selecting, moving, resizing, rotating, duplicating, and organizing nodes in OpenPencil.
---

# Selection & Manipulation

Select objects to move, resize, rotate, duplicate, and organize them on the canvas.
## Selecting

- **Click** a node to select it (deselects everything else)
- <kbd>Shift</kbd> + click to add or remove a node from the current selection
- **Marquee drag** — drag on empty canvas to draw a selection rectangle; all intersecting nodes are selected on release
- <kbd>⌘</kbd><kbd>A</kbd> — select all nodes on the current page
- **Click empty canvas** — deselect all

## Moving

- **Drag** a selected node to move it (all selected nodes move together)
- **Arrow keys** — nudge selected nodes by 1 px
- <kbd>Shift</kbd> + arrow keys — nudge by 10 px

Dragging into a frame makes the selection its children. Drag outside the current container to move it into the container under the pointer, or onto the page when no container is underneath. The highlighted container is the drop target. Reparenting preserves the objects' visual position and rotation; dropping into auto layout places them at the insertion marker.

In auto layout, left/right arrows reorder horizontal children and up/down arrows reorder vertical children. Each key press moves one slot, including with Shift. Selected siblings retain their relative order. Absolute-positioned children still nudge by pixels.

Press <kbd>Escape</kbd> during a drag to restore the original positions. Each drag is one undo step, including parent and sibling-order changes. Moving a selected parent and one of its descendants moves the parent once.

## Resizing

Selected nodes show 8 resize handles (4 corners + 4 edge midpoints). Drag any handle to resize.

- <kbd>Shift</kbd> + drag a corner handle to constrain proportions

## Rotating

Hover just outside a corner handle to see the rotation cursor. Drag to rotate.

- <kbd>Shift</kbd> + drag snaps rotation to 15° increments

## Duplicating

- <kbd>Alt</kbd> + drag (<kbd>⌥</kbd> + drag on Mac) — duplicate the selected node and move the copy
- <kbd>⌘</kbd><kbd>D</kbd> — duplicate in place

## Deleting

Press <kbd>Backspace</kbd> or <kbd>Delete</kbd> to remove all selected nodes.

## Z-Order

Change the stacking order of nodes within their parent:

- **]** — bring to front (top of sibling list)
- **[** — send to back (bottom of sibling list)

## Visibility & Lock

- <kbd>⇧</kbd><kbd>⌘</kbd><kbd>H</kbd> — toggle visibility. Hidden nodes don't render but stay in the layers panel.
- <kbd>⇧</kbd><kbd>⌘</kbd><kbd>L</kbd> — toggle lock. Locked nodes can't be selected or moved on canvas.

## Move to Page

Move selected nodes to a different page via the [context menu](./context-menu). The nodes are reparented under the target page's canvas.

## Editing several layers

With several layers selected, the properties panel shows what they have in common and reads **Mixed** where they differ; an edit changes all of them in one undo step.

- **Layout** shows their sizes, text resizing when text is selected, flow when every layer is a frame, and clip content for the frames among them. When the layers form one row or column, **Spacing** shows the gap between them; typing a value spaces them evenly from the first layer.
- **Typography** appears whenever text is selected and changes only the text.
- **Stroke** shows the stroke of the layers that have one; editing it strokes every selected layer.
- **Selection colors** lists every fill and stroke colour in the selection, including inside frames and groups, most used first. Changing one recolours it everywhere it is used.

## Sections

Drawing a section on the canvas automatically adopts overlapping sibling nodes as children of the new section.

## Keyboard Shortcuts

| Action | Mac | Windows / Linux |
|--------|-----|-----------------|
| Select all | <kbd>⌘</kbd><kbd>A</kbd> | <kbd>Ctrl</kbd> + <kbd>A</kbd> |
| Duplicate | <kbd>⌘</kbd><kbd>D</kbd> | <kbd>Ctrl</kbd> + <kbd>D</kbd> |
| Duplicate + move | <kbd>⌥</kbd> + drag | <kbd>Alt</kbd> + drag |
| Delete | <kbd>⌫</kbd> / Delete | <kbd>Backspace</kbd> / Delete |
| Nudge 1 px | <kbd>Arrow keys</kbd> | Arrow keys |
| Nudge 10 px | <kbd>⇧</kbd> + Arrow keys | <kbd>Shift</kbd> + <kbd>Arrow</kbd> keys |
| Bring to front | ] | ] |
| Send to back | [ | [ |
| Toggle visibility | <kbd>⇧</kbd><kbd>⌘</kbd><kbd>H</kbd> | <kbd>Shift</kbd> + <kbd>Ctrl</kbd> + <kbd>H</kbd> |
| Toggle lock | <kbd>⇧</kbd><kbd>⌘</kbd><kbd>L</kbd> | <kbd>Shift</kbd> + <kbd>Ctrl</kbd> + <kbd>L</kbd> |

## Tips

- Use the [Layers & Pages](./layers-and-pages) panel to see and reorder nodes when they overlap.
- See [Context Menu](./context-menu) for additional actions like grouping and component creation.
