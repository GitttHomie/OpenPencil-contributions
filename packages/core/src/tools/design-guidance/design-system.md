# Editable design systems

Inspect existing collections, variables, main components, and enabled libraries. Extend compatible foundations instead of creating a parallel system. For substantial new work, identify the repeated roles required by the user task before creating variables and components. A one-off illustration or a small edit does not require a component library.

Create a small set of meaningful variables before authoring their consumers. Prefer names expressing purpose, such as `Color/action`, `Color/text`, `Space/control`, and `Radius/control`, following existing naming conventions. Use the available collection and variable tools; capture returned IDs. Only create themes or modes when needed, using supported APIs.

Bind supported properties through `designVar` or `bind_variable`; declaring variables and copying their literal values into nodes does not create a reusable system. `defineVars` groups references and does not create collections. Use the canonical authoring reference for supported types and fields. Do not invent text-style APIs or assume every typography/effect field can be bound.

For variable-based typography, create or reuse the complete requested token set before creating text styles: font family, a compatible weight, size, line height, and letter spacing where supported. Zero tracking is still a value to bind when the user requests every value in variables. Bind the authoring text first, then create or update its style using supported style-authoring APIs. Do not capture a style from literal values and only bind the sample afterward.

Verify the bindings stored in each style definition, not just those on its sample text. Apply each completed style to fresh text with no existing bindings and check that its expected variables and resolved values arrive together. Also check switching from another style replaces the old typography bindings. A variable-backed family alone does not make the entire style variable-backed. If the connected tools cannot author or inspect styles, explain that limit instead of fabricating definition nodes or claiming the style system is complete.

When tokens have a meaningful arithmetic or logical relationship, use `openpencil.setVariableFormula(collectionName, variableName, source, modeName?)` through `eval` after creating them. For example, `{spacing/base} * 2` derives spacing, and `{enabled} AND NOT {busy}` derives visibility. References persist by ID and formulas follow collection modes. Keep consumers bound to the derived token. Numeric formulas use stored units (px for lengths); do not use the CSS-only expression field for live canvas calculations.

Create actual `Component` and, where useful, `ComponentSet` definitions, then use `Instance` to compose screens. A JSX helper function or cloned frame is not a linked instance. Expose meaningful text, visibility, and swap properties and create only variants and states relevant to the requested controls. Prefer library insertion when a suitable asset already exists.

## Compose a system that the screens actually use

Think at several scales, moving between them as the design develops:

- Foundations: bind recurring color, spacing and radius roles to variables. Use supported typography bindings or shared component defaults. Tokens are not substitutes for components.
- Small controls (atoms): Button, Text input, Checkbox, Avatar or Status badge, where the current task needs them. Text layers, separators and every decorative icon do not automatically need their own definition.
- Reusable patterns (molecules): a labeled field with help/error text, a search control, or a card's metadata row. Compose these from instances of existing controls when those controls are shared.
- Sections (organisms): a product card, navigation bar or form section whose structure or behavior is reused. Its buttons, badges and fields still reference their smaller main components. Making a Card component does not justify rebuilding Button inside it.
- Page arrangements and screens (templates and pages): arrange these parts and test them with real content. Keep one-off page scaffolding as auto-layout frames; make a layout component only when there is a useful reuse or customization contract.

For example, a service-results screen might reuse Button and Status badge inside Service card, then place Service card instances with different names, images and status in the results layout. All of the cards' buttons should trace back to the same Button definition. A change to that definition should reach them while each card keeps its own content.

Before creating a definition, search the existing catalog by role and inspect likely matches. Reuse the same main component for content changes. Use properties for labels and visibility, swaps for interchangeable components, slots for flexible child content, and variant properties for meaningful size/state/appearance choices. Do not make a separate variant for each customer, product title or photograph. Avoid huge sets containing combinations the task never uses.

Prototype one representative pattern with the needed controls, inspect its structure and content range, and refine it in context before creating many consumers. These scales are a way to reason about composition, not five mandatory delivery stages. Never require the user to approve each scale or create a complete library before showing useful design work.

Keep the actual component IDs and property IDs from successful calls. A second render call should compose or update them, not rebuild their definitions. Shared styling belongs in main definitions; put only intentional content/state differences on instances. A library board is useful only if the delivered screens reference its components.

Keep these links when customizing content. Different labels or icons belong in instance overrides, nested variants, swap properties, or slots; extend the main component if the required control is missing. Never detach an instance just to make its children editable. Load `creation` for the supported linked editing routes and verify the resulting component references.

## Layout and verification

Use auto-layout for content, Hug for content-sized containers, and Fill for available space in a suitable parent. Avoid circular Hug/Fill sizing. Reserve absolute positioning for deliberate overlays or artwork; verify the overlay's constraints when its parent changes size. Use real content and wrapping instead of guessed fixed heights.

Use frames with auto-layout for UI containers, rows, columns, cards, and controls. Do not create GROUP nodes, use `Group` in JSX, or call `figma.group` through eval. Compose existing components inside auto-layout frames. Preserve existing imported groups unless the user asks to restructure them; use intentional absolute positioning inside frames for overlays and artwork.

Use frames for all layout surfaces and photo containers; reserve shape nodes for graphics and illustration. A full-card photo is the card frame's image fill, with scrims layered as additional fills and content kept as children. A photo placeholder is a frame and may contain an icon. `stock_photo` accepts populated frames and preserves their children and overlay fills.

For a photo scrim, use the canonical layered-fill example or append with `set_fill` using `operation="append"`. Replace a particular scrim by its returned `fill_index`; a plain `set_fill` replaces the entire stack. Confirm the returned fills include the image and the gradient, and inspect the rendered contrast before declaring the scrim complete.

Keep main components discoverable with useful names and grouping. Separate foundations, components, and screens into sections or pages when the scope warrants it; do not reorganize unrelated content. Compose larger patterns from reusable parts while preserving appropriate instance overrides.

Verify actual bindings and instance relationships. Where in scope, check that changing a main component or token updates consumers while preserving overrides, then restore any temporary test edits. Check narrow containers and longer labels. Modes can affect paint and geometry differently: later mode changes do not guarantee scalar-layout recomputation. Inspect the resulting bounds instead of claiming automatic responsiveness.

Trace at least one representative reuse chain from a screen instance through its nested pattern/control instances to their main definitions and bound variables. Check every kind of repeated UI involved in the requested work, not just the easiest button. Fix accidental copies and unnecessary divergent definitions before scaling the design, using supported replacement routes and preserving user content. Do not claim an atomic system merely because some components exist.
