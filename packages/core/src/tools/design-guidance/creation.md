# Editable creation capabilities

Use the connected tool schemas and the canonical design authoring reference for exact arguments. Inspect the document first; the routes below extend existing objects without recreating screens. Capabilities are choices for the user's design, not a checklist to apply to every object.

## Foundations and layout

- Create collections and typed variables with `create_collection` and `create_variable`; use `bind_variable` for existing nodes or `designVar(...)` in JSX. Bind repeated spacing as well as colors. `node_bindings` inspects bindings. Use `unbind_variable` to detach one field before giving it an independent value. Expanding grouped padding, corners, or borders does not mean their values should become unrelated.
- Use `render` with `flex`, Hug/Fill sizing, wrapping or grid props for structured creation. Use `set_layout` and `set_layout_child` for existing flex layouts. Use the authoring reference for grid tracks, spans and row/column gaps; do not substitute guessed coordinates.
- A badge excluded from its parent's flow needs `position="absolute"` in JSX or `set_layout_child` with `positioning="ABSOLUTE"`, plus `set_constraints`. Normal auto-layout children take position from layout. Test longer text on both the control and the badge; right-pinning and Hug sizing must work together. Keep clipping off when the intended badge extends outside its parent.
- Use `set_radius` with `corner_smoothing` where a smooth corner suits the design. Shared radii need actual bindings; smoothing is optional, not a universal style.

## Component properties and slots

1. Inspect `get_component_properties` on the main component, one of its children, or an instance. It returns stable property IDs, owning components, defaults, bindings, slot settings and instance assignments.
2. Create a definition with `create_component_property`: `TEXT` for a String, `BOOLEAN` for visibility, or `INSTANCE_SWAP` for a nested component choice. Bind a child with `bind_component_property` and field `TEXT`, `VISIBLE`, or `INSTANCE_SWAP`. Multiple compatible objects can share a definition.
3. Use `edit_component_property` to change the main component's default or name. Use `set_instance_properties` with an ID-to-value object for one instance. This keeps content-driven sizing and fixed text modes intact. Do not directly overwrite a property-controlled child and leave its definition contradicting the canvas.
4. Unbind one field with `bind_component_property` and `property_id=null`; its current value remains. `delete_component_property` removes the definition and its links while retaining the objects.
5. For customizable child content, create a frame inside the main component and call `create_component_slot` with that frame ID. Existing children become the default content. `configure_component_slot` sets preferred components, child limits, empty-state display and stretching. In an instance, insert or move children into its slot frame using normal supported creation/move operations; ordinary instance structure stays protected. `reset_instance_slot` discards that slot's customization and restores defaults.

Variants and exposed properties solve different problems. Use `combine_as_variants` or a JSX `ComponentSet` for states with different structure or appearance, and property assignments for content changes. Follow the canonical reference for selecting a variant. Inspect actual instance bounds after switching.

## Paints, photos and typography

- Put a photo in its frame's image fill using `stock_photo` or `set_image_fill`; retain text and controls as children. Placeholders are frames too.
- `set_paint` appends, replaces or removes one indexed fill or stroke while preserving the rest. It supports multiple stops, transparent colors, and linear, radial, angular and diamond gradients. Paint arrays run bottom to top. Use `target="fills"` for a card's scrim above its image; use `target="strokes"` for a gradient border. Replacing a stroke paint preserves its width, alignment, cap, join and dashes unless provided. A replacement detaches that paint's color variable; removing a paint shifts later color bindings with their paints.
- A paint's normalized `transform` controls position, rotation and scale. Inspect an existing transform before editing it. For a simple edge-to-edge linear scrim, `set_fill` already provides named directions including diagonals. Read back both paint stacks and inspect a rendered export; describing an overlay does not create it.
- For side-specific borders, use JSX `strokeWeights`; use the authoring reference for shadows, blur, blend modes and clipping. Preserve unrelated paints when changing one visual treatment.
- Inspect available fonts and `get_font_status`, use a weight the selected family supports, and verify actual wrapping after fonts load. `set_text_resize` selects automatic width/height or a fixed text box; changing content or weight is not a reason to reset that choice.

Check the result at realistic size and with longer content. Confirm variable bindings, property links, slot content and inherited instance sizing—not only the screenshot. Do not invent formula variables or property-default variable links: use only capabilities advertised by the connected version.
