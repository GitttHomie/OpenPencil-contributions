# Component composition

Use atomic design within this product: bound tokens underpin small controls; linked controls compose reusable patterns; patterns compose sections; screens arrange their instances with real content. Reuse existing definitions before creating new ones. Shared buttons, badges, avatars and fields remain nested instances inside cards, forms and navigation—not freshly drawn copies.

Before repeating a UI pattern, establish its main component and the properties, variants, swaps or slots needed for its differences. Different text, images or icons do not by themselves require another main component. Keep instances connected. Do not count JSX helper functions, cloned frames or unused component boards as reuse.

An enclosing component board is optional. Keep definitions clear of screens and each other; verify both the definitions and their screen instances after changes.

Preserve component sizing when reusing instances; change exposed content and let auto-layout recalculate. For a stretching instance, size its surrounding auto-layout frame and set the instance to Fill on the intended axis instead of assigning a numeric size. Its Fill contents follow, even if the main component is Fixed. Keep other axes and the main definition unchanged unless the requested design requires an override.

Validate one representative composition before multiplying it: inspect nested component IDs, actual variable bindings, content overrides and layout with longer content. Refine the shared definitions, then reuse them. A component count or a polished screenshot does not prove this structure.

Confirm a real content edit succeeds on that first instance before queuing the rest. If a document-wide or connection error blocks editing, stop dependent calls and report the blocker once. Inspect a fresh image after the final successful change; an earlier screenshot does not verify the final composition. Library sample copy is not evidence of the new product's capabilities.

For library discovery, use semantic `get_components` searches with `include_variants: true` to get variant IDs and sizes without reopening the same trees. Read the chosen component's exposed properties once. Find spacing tokens with `find_variables` (`type: "FLOAT", compact: true`); narrow the query if results are truncated. Retrieve full details by ID only when needed.

Reorder existing sections with `reparent_node` and an explicit `index`; verify the returned position. Preserve content overrides when correcting layout instead of replacing a populated instance with a fresh copy.

Before stacking sections, inspect their built-in whitespace. Use `analyze_spacing` on the screen: `boxGap` measures adjacent section boxes, while `innerContentGap` includes their immediate children's offsets and wrapper padding. Neither measures painted pixels. Choose a spacing convention for this screen and avoid adding the same separation in section padding, wrapper padding and outer gaps. Check a screenshot to distinguish intentional empty space from missing media. Batch related text replacements using `batch_update` with `props.text`, or exposed values with `set_instance_properties`; inspect reflow after the section's batch, not after every label.

Prefer one logical batch to repeated property calls. Property tools accept `ids` with shared values, such as `set_font {ids:["…","…"],family:"Inter",size:16}`, or `items` containing complete arguments for different values. Use native arrays in `batch_update {operations:[{id:"…",props:{text:"Local recording"}}]}`. Keep batches bounded to related content; a failed batch keeps none of its changes. Inspect once after the batch rather than between every label or spacing edit.

Keep this proportional: one-off page arrangements, text and illustration can remain ordinary nodes. Do not wrap every layer, impose a fixed component quota or build unused foundations. Preserve this product's visual identity. Small edits stay small; briefs, PRDs and stage approvals remain optional.

Create related tokens with `create_variable {items:[{name:"space/md",type:"FLOAT",collection_id:"…",value:16},{name:"enabled",type:"BOOLEAN",collection_id:"…",value:true}]}`. Bind a shared token with `bind_variable {ids:["…","…"],field:"itemSpacing",variable_id:"…"}`; use `items` when fields or variables differ. Use `import_design_tokens` for whole token files with collections, modes and aliases.

Create repeated content with `create_instance {items:[{component_id:"…",parent_id:"…",sizing_horizontal:"FILL",values:{"property-id":"First label"}},{component_id:"…",parent_id:"…",sizing_horizontal:"FILL",values:{"property-id":"Second label"}}]}`. Read stable property IDs with `get_component_properties` first. Omitted sizing preserves the component definition. Batch later overrides with `set_instance_properties` using shared `ids` or distinct `items`; keep the instances connected. Component-property creation, editing, deletion and binding also accept batches.

Inspect related targets with `get_node {ids:["…","…"]}`, `get_component_properties`, `node_bounds`, `node_bindings`, `get_variable`, `get_collection`, or `analyze_spacing`. Bulk reads return indexed results and per-item errors within a 48,000-character budget; retry omitted or oversized targets with smaller scopes. Batch `get_node` defaults to depth 0 and `node_tree` to depth 1; single-target defaults stay unchanged.
