# Editable design systems

Inspect existing collections, variables, main components, and enabled libraries. Extend compatible foundations instead of creating a parallel system. For substantial new work, identify the repeated roles required by the user task before creating variables and components. A one-off illustration or a small edit does not require a component library.

Create a small set of meaningful variables before authoring their consumers. Prefer names expressing purpose, such as `Color/action`, `Color/text`, `Space/control`, and `Radius/control`, following existing naming conventions. Use the available collection and variable tools; capture returned IDs. Only create themes or modes when needed, using supported APIs.

Bind supported properties through `designVar` or `bind_variable`; declaring variables and copying their literal values into nodes does not create a reusable system. `defineVars` groups references and does not create collections. Use the canonical authoring reference for supported types and fields. Do not invent text-style APIs or assume every typography/effect field can be bound.

Create actual `Component` and, where useful, `ComponentSet` definitions, then use `Instance` to compose screens. A JSX helper function or cloned frame is not a linked instance. Expose meaningful text, visibility, and swap properties and create only variants and states relevant to the requested controls. Prefer library insertion when a suitable asset already exists.

Use auto-layout for content, Hug for content-sized containers, and Fill for available space in a suitable parent. Avoid circular Hug/Fill sizing. Reserve absolute positioning for deliberate overlays or artwork; verify the overlay's constraints when its parent changes size. Use real content and wrapping instead of guessed fixed heights.

Use frames for all layout surfaces and photo containers; reserve shape nodes for graphics and illustration. A full-card photo is the card frame's image fill, with scrims layered as additional fills and content kept as children. A photo placeholder is a frame and may contain an icon. `stock_photo` accepts populated frames and preserves their children and overlay fills.

For a photo scrim, use the canonical layered-fill example or append with `set_fill` using `operation="append"`. Replace a particular scrim by its returned `fill_index`; a plain `set_fill` replaces the entire stack. Confirm the returned fills include the image and the gradient, and inspect the rendered contrast before declaring the scrim complete.

Keep main components discoverable with useful names and grouping. Separate foundations, components, and screens into sections or pages when the scope warrants it; do not reorganize unrelated content. Compose larger patterns from reusable parts while preserving appropriate instance overrides.

Verify actual bindings and instance relationships. Where in scope, check that changing a main component or token updates consumers while preserving overrides, then restore any temporary test edits. Check narrow containers and longer labels. Modes can affect paint and geometry differently: later mode changes do not guarantee scalar-layout recomputation. Inspect the resulting bounds instead of claiming automatic responsiveness.
