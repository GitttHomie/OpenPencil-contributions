# Editable creation capabilities

Use the connected tool schemas and the canonical design authoring reference for exact arguments. Inspect the document first; the routes below extend existing objects without recreating screens. Capabilities are choices for the user's design, not a checklist to apply to every object.

## Foundations and layout

- Create collections and typed variables with `create_collection` and `create_variable`; use `bind_variable` for existing nodes or `designVar(...)` in JSX. Bind repeated spacing as well as colors. `node_bindings` inspects bindings. Use `unbind_variable` to detach one field before giving it an independent value. Expanding grouped padding, corners, or borders does not mean their values should become unrelated.
- Use `render` with `flex`, Hug/Fill sizing, wrapping or grid props for structured creation. Use `set_layout` and `set_layout_child` for existing flex layouts. Use the authoring reference for grid tracks, spans and row/column gaps; do not substitute guessed coordinates.
- A badge excluded from its parent's flow needs `position="absolute"` in JSX or `set_layout_child` with `positioning="ABSOLUTE"`, plus `set_constraints`. Normal auto-layout children take position from layout. Test longer text on both the control and the badge; right-pinning and Hug sizing must work together. Keep clipping off when the intended badge extends outside its parent.
- Use `set_radius` with `corner_smoothing` where a smooth corner suits the design. Bind recurring smoothing with `bind_variable` and field `cornerSmoothing`; its numeric value is a unit fraction, so `0.6` is 60%. Shared radii need actual bindings; smoothing is optional, not a universal style.

## Component properties and slots

1. Inspect `get_component_properties` on the main component, one of its children, or an instance. It returns stable property IDs, owning components, defaults, bindings, slot settings and instance assignments.
2. Create a definition with `create_component_property`: `TEXT` for a String, `BOOLEAN` for visibility, or `INSTANCE_SWAP` for a nested component choice. Bind a child with `bind_component_property` and field `TEXT`, `VISIBLE`, or `INSTANCE_SWAP`. Multiple compatible objects can share a definition.
3. Use `edit_component_property` to change the main component's default or name. Use `set_instance_properties` with an ID-to-value object for one instance. This keeps content-driven sizing and fixed text modes intact. Do not directly overwrite a property-controlled child and leave its definition contradicting the canvas.
4. Unbind one field with `bind_component_property` and `property_id=null`; its current value remains. `delete_component_property` removes the definition and its links while retaining the objects.
5. For customizable child content, create a frame inside the main component and call `create_component_slot` with that frame ID. Existing children become the default content. `configure_component_slot` sets preferred components, child limits, empty-state display and stretching. In an instance, insert or move children into its slot frame using normal supported creation/move operations; ordinary instance structure stays protected. `reset_instance_slot` discards that slot's customization and restores defaults.

Variants and exposed properties solve different problems. Use `combine_as_variants` or a JSX `ComponentSet` for states with different structure or appearance, and property assignments for content changes. Follow the canonical reference for selecting a variant. Inspect actual instance bounds after switching.

When reusing a component, inherit its existing Fixed, Hug, and Fill settings. Do not supply numeric instance dimensions merely to reproduce the main component's current bounds. Change exposed content and visibility, then let auto-layout recalculate the result. Set an explicit dimension or change a sizing mode only when the requested design requires that override; a stale-looking measurement is not a reason to lock a Hug instance to a fixed size.

A component's own layout and its placement in another frame are separate. A main component can be Fixed with Fill contents, while its instance fills a surrounding auto-layout frame. To make it stretch, size the surrounding frame and set the instance to Fill on the intended axis; its Fill contents follow. Keep the main definition unchanged and preserve the other axis. Ensure the surrounding layout establishes that axis's size rather than creating a circular Hug/Fill dependency.

### Changing an icon without disconnecting instances

Keep the parent and nested icon linked to their main components. Choose the mechanism that fits the existing design: icon variants for a defined family, an `INSTANCE_SWAP` property for component choices, or a slot for flexible content. Keep the main component set with the other definitions; nest an instance of one of its variants in the parent. An enclosing component board is not required.

For an existing parent without an icon control, inspect its main definition and create or reuse the icon components. In the main definition, use an icon instance and expose its `INSTANCE_SWAP` field through `create_component_property` and `bind_component_property`. Alternatively, `expose_instance_swap` exposes existing nested instances with preferred component candidates. Inspect `get_component_properties` for the returned property ID, then call `set_instance_properties` on each parent instance with that ID mapped to the chosen icon component ID (a variant's component ID also works). This changes the icon choice without replacing the parent.

For a slot, use `create_component_slot` on the main component's content frame, then edit only the corresponding slot content in the target instance. Do not delete protected children or detach the enclosing instance to insert content. Discover the connected tool/API before using another route, including nested variant exposure; do not assume editor-only actions are scripting methods.

After the edit, verify that the parent is still an `INSTANCE` linked to the same main component, that the nested icon resolves to the intended component, and that other instances retain their choices. Confirm the control is exposed to the user. A screenshot alone cannot verify these relationships. A failed structural edit is a reason to inspect properties or slots, not to detach.

## Paints, photos and typography

- Put a photo in its frame's image fill using `stock_photo` or `set_image_fill`; retain text and controls as children. Placeholders are frames too.
- For a Blender render or another image on disk, use `import_image` with the original file path and target frame ID. It preserves the file's bytes and returns a source receipt. Save the final render inside the tool's allowed directory. Do not substitute a screenshot, thumbnail, or Base64 reconstructed from model vision; if original-file import is unavailable, explain the limitation.
- `set_paint` appends, replaces or removes one indexed fill or stroke while preserving the rest. It supports multiple stops, transparent colors, and linear, radial, angular and diamond gradients. Paint arrays run bottom to top. Use `target="fills"` for a card's scrim above its image; use `target="strokes"` for a gradient border. Replacing a stroke paint preserves its width, alignment, cap, join and dashes unless provided. A replacement detaches that paint's color variable; removing a paint shifts later color bindings with their paints.
- A paint's normalized `transform` controls position, rotation and scale. Inspect an existing transform before editing it. For a simple edge-to-edge linear scrim, `set_fill` already provides named directions including diagonals. Read back both paint stacks and inspect a rendered export; describing an overlay does not create it.
- For side-specific borders, use JSX `strokeWeights`; use the authoring reference for shadows, blur, blend modes and clipping. Preserve unrelated paints when changing one visual treatment.
- Inspect available fonts and `get_font_status`, use a weight the selected family supports, and verify actual wrapping after fonts load. `set_text_resize` selects automatic width/height or a fixed text box; changing content or weight is not a reason to reset that choice.

Check the result at realistic size and with longer content. Confirm variable bindings, property links, slot content and inherited instance sizing—not only the screenshot. Do not invent formula variables or property-default variable links: use only capabilities advertised by the connected version.
