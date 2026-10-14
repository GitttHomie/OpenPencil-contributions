---
title: Drawing Shapes
description: Creating rectangles, ellipses, lines, frames, sections, polygons, and stars in OpenPencil.
---

# Drawing Shapes

The bottom toolbar provides tools for creating shapes, frames, and sections. Select a tool, then click and drag on the canvas to draw.
## Toolbar Tools

| Tool | Shortcut | Description |
|------|----------|-------------|
| Rectangle | <kbd>R</kbd> | Draws a rectangle |
| Ellipse | <kbd>O</kbd> | Draws an ellipse |
| Line | <kbd>L</kbd> | Draws a line |
| Frame | <kbd>F</kbd> or <kbd>A</kbd> | Draws a frame (container for other nodes) |
| Section | <kbd>Shift</kbd> + <kbd>S</kbd> | Draws a section (takes in the siblings it fully covers) |

## Shapes Flyout

The shapes flyout (accessible from the toolbar) includes additional shapes:

- **Polygon** — creates a polygon with 3 sides by default (triangle)
- **Star** — creates a 5-pointed star with 0.38 inner radius

Polygon and Star have no keyboard shortcut — access them from the shapes flyout in the toolbar.

## Customizing the Toolbar

Right-click the toolbar and choose **Customize toolbar…**, or open **Settings → Toolbar**, to change it:

- Turn a tool's switch off to hide it. Hidden tools keep their keyboard shortcuts. **Move** is always shown.
- Drag a tool to reorder it. Dropped inside a box it joins that flyout; dropped in the gap between boxes it becomes a button of its own; dropped onto another tool, the two share a flyout.
- A tool's **⋯** menu moves it up or down, groups it with the tool above, or ungroups it from its flyout. Its grip also moves it with <kbd>↑</kbd> and <kbd>↓</kbd>.
- **Insert icon** runs a command rather than picking a tool, so it can move and hide but not join a flyout.

**Reset to default** restores the original layout. Tools added in later versions join their default flyout, so a customized toolbar still gets them.

## Constrained Drawing

Hold <kbd>Shift</kbd> while dragging to constrain the shape:

- Rectangle → square (equal width and height)
- Ellipse → circle
- Line → snaps to 0°/45°/90° angles

## Shape Properties

After drawing a shape, select it to edit its properties in the Design tab of the properties panel.

### Fill

Every shape can have a fill. The fill section supports:

- **Solid color** — pick via the HSV color picker or type a hex value
- **Gradient** — Linear, Radial, Angular, or Diamond with editable gradient stops. While the gradient's picker is open, the canvas shows its handles: drag an end or a radius dot to move it, hold <kbd>Shift</kbd> to turn it in 15° steps, and drag a stop's square to slide the stop along the line
- **Image** — select an image file as the fill

With one layer selected, open a gradient fill to show its handles on the canvas. Drag the middle handle to move the gradient. Linear gradients have two endpoints for rotation and length; radial, angular, and diamond gradients have a center and two radius handles. Handles snap near the object's edges, corners, and center lines, with guides showing the alignment. Direction snapping includes horizontal, vertical, 45° diagonals, and the object's own diagonals. This allows edge-to-edge and corner-to-corner placement on the same or opposite edges, including rotated objects.

Hold Shift for 15° angle steps, or Alt/Option for free placement. Corners and edge midpoints take priority when nearby. Escape cancels the current drag, and Undo restores the previous gradient in one step.

### Stroke

Add an outline to any shape. Stroke properties include:

- **Width** — uniform or per-side (Top/Right/Bottom/Left) via the side selector dropdown
- **Color** — solid color with opacity
- **Alignment** — Inside, Center, or Outside the shape boundary (clip-based rendering matches Figma behavior)
- **Cap style** — None, Round, Square, Arrow Lines, Arrow Equilateral (for open paths)
- **Join style** — Miter, Bevel, Round
- **Dash pattern** — dash-on/dash-off

### Corner Radius

Available for rectangles, frames, components, instances, polygons, and stars. Click the independent corners toggle to set each corner (top-left, top-right, bottom-left, bottom-right) separately; a polygon's or star's corners share one radius, which rounds its inner corners too.

On the canvas, hover a selected rectangle to show a handle inside each corner and drag one to round the corners. Equal corners change together and differing ones one at a time; hold <kbd>⌥</kbd> to swap the two and <kbd>⇧</kbd> to round to tens. A polygon or star has one radius handle, below its top point, which rounds all of its corners; drag the handle on its next point around the centre to change the point count, and a star's handle on its first inner point towards or away from the centre to change its ratio. The handles hide while the shape is under 108 pixels across on screen; zoom in to reach them.

### Effects

Add visual effects from the Effects section:

- **Drop Shadow** — offset, blur radius, spread, color
- **Inner Shadow** — same controls, rendered inside the shape
- **Layer Blur** — blurs the entire node
- **Background Blur** — blurs content behind the node
- **Foreground Blur** — blurs content in front

Click **+** to add an effect. Each effect row is collapsible with inline controls. Toggle the eye icon to enable/disable an effect.

## Frames and Sections

**Frames** are containers. Drag shapes into a frame to make them children. New frames clip their content by default (turn off **Clip content** to show overflowing children) and support [auto layout](./auto-layout).

Start drawing inside a frame to create a child of that frame. The frame highlights while you draw; the new object's size follows the pointer and it joins the frame when you release. In an auto-layout frame, the starting point determines the insertion slot. Escape cancels creation, and Undo removes the new child in one step.

Select the Frame tool to browse collapsible presets for phones, tablets, desktops, presentations, watches, paper, social media, Figma Community assets, and archived devices in the Design panel. Choosing a preset creates a named frame centered in the viewport and returns to the Select tool. With an existing frame selected, use its Frame preset dropdown to resize it without changing its name.

**Sections** are top-level containers that automatically adopt overlapping sibling nodes when drawn. They're useful for organizing large canvases into logical areas. Sections display a title pill that you can drag.

## Keyboard Shortcuts

| Action | Mac | Windows / Linux |
|--------|-----|-----------------|
| Rectangle tool | <kbd>R</kbd> | <kbd>R</kbd> |
| Ellipse tool | <kbd>O</kbd> | <kbd>O</kbd> |
| Line tool | <kbd>L</kbd> | <kbd>L</kbd> |
| Frame tool | <kbd>F</kbd> or <kbd>A</kbd> | <kbd>F</kbd> or <kbd>A</kbd> |
| Section tool | <kbd>⇧</kbd><kbd>S</kbd> | <kbd>Shift</kbd> + <kbd>S</kbd> |
| Constrain to square/circle | <kbd>Shift</kbd> + drag | <kbd>Shift</kbd> + drag |

## Tips

- Sections can only exist at the top level — they can't be nested inside frames.
- Use frames with [auto layout](./auto-layout) to build responsive layouts.
- [Export](./exporting) individual shapes or groups as images via the properties panel or context menu.
