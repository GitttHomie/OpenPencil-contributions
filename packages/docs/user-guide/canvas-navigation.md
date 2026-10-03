---
title: Canvas Navigation
description: Panning, zooming, ruler guides, snapping, and distance measurements in OpenPencil.
---

# Canvas Navigation

The canvas is your infinite workspace. You can pan and zoom freely to navigate your design.

## Panning

Move the visible area of the canvas without affecting any objects.

- <kbd>Space</kbd> + drag — hold Space and drag anywhere on the canvas
- **Middle mouse drag** — press and drag the middle mouse button
- **Two-finger trackpad** — swipe with two fingers on a trackpad
- <kbd>Shift</kbd> + mouse wheel — pan horizontally

## Hand Tool

Press <kbd>H</kbd> to activate the hand tool for continuous panning. Any drag on the canvas pans the viewport without needing to hold Space. Switch to another tool (e.g., **V** for Select) to deactivate.

## Zooming

Zoom in and out centered on your cursor position.

- <kbd>Ctrl</kbd> + scroll (or <kbd>⌘</kbd> + scroll on Mac) — scroll up to zoom in, scroll down to zoom out
- **Pinch gesture** — pinch on a trackpad to zoom in/out
- **Keyboard shortcuts** — see table below

Pinch-to-zoom on UI panels (layers, properties) is prevented so it doesn't accidentally change the browser zoom level.

## Keyboard Shortcuts

| Action | Mac | Windows / Linux |
|--------|-----|-----------------|
| Pan | <kbd>Space</kbd> + drag | <kbd>Space</kbd> + drag |
| Hand tool | <kbd>H</kbd> | <kbd>H</kbd> |
| Zoom in | <kbd>⌘</kbd><kbd>+</kbd> | <kbd>Ctrl</kbd> + <kbd>+</kbd> |
| Zoom out | <kbd>⌘</kbd><kbd>−</kbd> | <kbd>Ctrl</kbd> + <kbd>−</kbd> |
| Zoom to 100% | <kbd>⌘</kbd><kbd>0</kbd> | <kbd>Ctrl</kbd> + <kbd>0</kbd> |

## Ruler Guides

Enable **View → Rulers**, then drag from the top ruler for a horizontal guide or the left ruler for a vertical guide. Drop onto the page for a canvas guide, or onto a frame for a guide in that frame's coordinates.

- Click a guide to select it; drag it to reposition it or transfer it between the page and a frame.
- Hold <kbd>Option</kbd> / <kbd>Alt</kbd> while dragging an existing guide to duplicate it.
- Drag a guide back onto a ruler to remove it, or use its context menu's **Remove guide** action.
- Guide changes support undo/redo and are preserved in `.fig` files.

## Pixel grid

Toggle **Pixel Grid** in the zoom dropdown or **View → Pixel Grid**, or press <kbd>⌘</kbd>/<kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>P</kbd>. The checkmarks stay synchronized. Grid lines appear at **800% zoom and above**, follow document pixel boundaries while panning, and are hidden again when you zoom out.

This is a view-only overlay: it does not change pixel snapping, enter undo history, or appear in exports. Use the zoom dropdown's percentage field to enter a close-up zoom such as `800`.

## Snapping

Under **View → Preferences**, toggle **Snap to Geometry**, **Snap to Objects**, and **Snap to Pixel Grid** independently. Preferences are saved between sessions.

Geometry and object snapping help align vector points, moved layers, and resized edges with nearby geometry, objects, guides, and frame bounds. Alignment lines appear for those targets; pixel-grid rounding does not draw an alignment line for every pixel.

Pixel snapping enforces whole-pixel positions and dimensions when drawing, moving, resizing with handles, and aligning, at every zoom level. You can still type decimal values into numeric fields; the next move or resize snaps the edited geometry back to pixels. Auto-layout can calculate fractional positions and sizes. Existing document geometry is preserved until edited, and undo restores the exact original values.

Hold <kbd>Control</kbd> during a layer drag to temporarily bypass alignment guides. Pixel snapping still applies; turn off **Snap to Pixel Grid** to drag with fractional geometry.

## Distance Measurements

Select a layer, hold <kbd>Option</kbd> on macOS or <kbd>Alt</kbd> on Windows/Linux, and hover another layer to see temporary distance measurements. Releasing the modifier clears the overlay; it does not add guides or change the document.

## Command Palette

Press <kbd>⌘</kbd><kbd>K</kbd> on macOS or <kbd>Ctrl</kbd> + <kbd>K</kbd> on Windows/Linux to search editor and application actions. Select a result to run it; unavailable actions remain subject to the current selection and document state.

The palette also moves between pages. Before you type, it lists the pages you visited recently in this tab, most recent first, and **Go to page…** opens a list of every page. Typing a page name finds it too.

## Tips

- Zooming always targets the cursor position, so point at what you want to see closer.
- The hand tool is useful when you need to pan frequently — it stays active until you switch tools.
- See [Selection & Manipulation](./selection-and-manipulation) for how to work with objects on the canvas.
