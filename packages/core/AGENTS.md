# Core

Renderer, layout, editor, Figma API, tools, clipboard, vector conversion, and document I/O. Depends on scene-graph, pen, kiwi, and fig. Framework-neutral: no Vue, no app imports, no browser DOM; guard browser globals explicitly.

- Public surface is the compatibility barrel plus the subpaths listed in `packages/core/package.json` `exports`; add a subpath there rather than deep-importing.
- CanvasKit runtime loading is centralized in `@open-pencil/core/canvaskit`. Headless raster export may dynamically load `canvaskit-wasm/full`; elsewhere `import type` and pass CanvasKit in.
- Drawing and input share preview-aware geometry through `@open-pencil/core/geometry`, built on Scene Graph matrices. Use it for world/screen transforms, inverses, bounds, and handle placement.
- Content an author wrote (design JSX, HTML, `.pen`) gets its sizes and positions from `layoutAuthoredNodes` in `packages/core/src/layout.ts`, which measures text that resizes to its content wherever it sits and then lays out the pages involved; renderers and readers of authored formats call it, while `.fig` keeps the geometry it stores (`packages/core/tests/layout/authored.test.ts`).
- HTML is styled by whoever has a CSS runtime and built into layers by `sceneGraphFromStyledHTML` (`packages/core/src/io/formats/html/layers.ts`), which browser builds may bundle. `readHTMLDocument` and `headlessHTMLReader` use the headless CSS runtime, which cannot be bundled for browsers, so they stay out of `BUILTIN_IO_FORMATS` and the CLI registers the reader (`packages/core/tests/io/formats/html/import.test.ts`).
- Copies of part of a document, such as previews, history snapshots, and exports, come from `extractPageContext` or `extractExportGraph` in `packages/core/src/io/subgraph.ts`, not another copier. Pass `componentSets` when instances must switch variant and `shareTables` for a read-only view rebuilt often (`packages/core/tests/io/subgraph.test.ts`).
- Undo for structural AI and MCP edits records only what an edit touches with `captureDocumentChange`: the edit's page is copied up front, and another page or the document node the first time `SceneGraph.observeNodeChanges` reports it about to change, so code that writes into a node directly calls `willChangeNode` first. Copies share values rather than deep-copying, so values must be replaced rather than written into, apart from the child lists, source metadata, and override maps it copies; comments on the document node stay out of undo (`packages/core/tests/editor/history/document-change.test.ts`).

## Layout

- `@open-pencil/yoga-layout` supplies both flexbox and CSS Grid.
- Recompute layout after demo creation and for each materialized or imported page; scope computation to the affected page or subtree where possible.
- The first Hug/Fill dimension mutation switches only that axis to Fixed; focus is non-destructive, and mode/value changes share one undo transaction.
- Explicit sizing choices retain cross-axis Hug + Fill when a visible in-flow sibling independently sizes that axis; other cases convert the dependent sizing to Fixed in the same undo transaction and emit `layout:sizing-converted` for app feedback (`packages/core/tests/editor/layout/sizing.test.ts`).
- Editor and scripting layout entrypoints share graph-owned edit tracking in `layout/invalidation.ts`; layout edits release saved geometry for the connected flow tree, while import, history restoration and appearance-only edits preserve it. Reflow from an edit records the geometry needed for saving; previews restore that metadata on cancellation (`packages/core/tests/layout/auto-layout/saved-state/`).
- Older OpenPencil archives with contradictory start-aligned padding release only their affected flow trees during reading; page preparation reflows them and archive export retains the recovery. Ordinary Figma imports preserve their saved geometry (`packages/core/tests/layout/auto-layout/saved-state/recovery.test.ts`).

## Components and instances

- Component types and their descendants use `#9747ff` for editor indicators; resolve ancestry with Scene Graph's `isInComponent`, while slots retain their distinct color (`packages/core/src/canvas/overlays/selection.ts`).
- Component edits propagate through editor component sync in `packages/core/src/editor/components/`; never hand-copy properties in app UI. Use Scene Graph copy helpers for nested values.

## Vector conversion

- Shared vector bounds, path sinks, and cached fill regeneration live in Scene Graph's `vector/` domain. The FIG reader fits legacy oversized path boxes after materialization, preserving artwork placement and saved transforms (`packages/core/tests/editor/vector-bounds.test.ts`).
- Bitmap-to-vector conversion lives in `packages/core/src/vector/vectorize/`; app provider clients, preferences, and credential resolution live under `src/app/editor/vectorize/` in the app. Bound request and response sizes and validate provider-owned download URLs before importing returned SVG.

## Tools (AI, MCP, CLI, WebMCP)

- Operations are `ToolDef`s under `packages/core/src/tools/**`; `schema.ts` defines the contract and registries expose them. Each definition owns its native Valibot `input`, execution/mutation metadata, and optional per-interface exposure exclusions (`mcp`, `ai`, `webmcp`). Exposure defaults to inclusion; adapters use `isToolExposed()`, then apply execution support and user permissions independently.
- Infer arguments from the schema; derive effects and default capabilities from execution metadata. Do not maintain parameter DSLs or tool-name lists. Add work to the nearest existing domain and the appropriate registry.
- Synchronous bulk tools use `withBatch` under `tools/batch/` to derive `ids` and `items` from their single-item schema; local mutation batches share an incremental rollback checkpoint and host-owned layout/undo. Mixed property patches reuse the focused tools' validators and setters instead of coercing unknown values; `packages/core/tests/tools/batch/` and `packages/core/tests/tools/structure/batch.test.ts`.
- `packages/core/src/tools/ai-adapter.ts` converts ToolDefs for Vercel AI; the app binds them to the active editor's `FigmaAPI` in `src/app/ai/tools/index.ts`. MCP v2 registration uses Standard Schema with Valibot JSON Schema conversion; AI and WebMCP adapters share the same input contract.
- `packages/core/src/editor/history/atomic-tool.ts` owns synchronous property/variable transactions; its incremental Scene Graph checkpoint captures node writes announced through `willChangeNode`, including layout and other pages. AI, MCP, and WebMCP share this execution path; async and structural tools cannot declare atomic property execution (`packages/core/tests/editor/history/large-document.test.ts`).
- Shared scene-authoring guidance and tested examples live under `packages/design-jsx/src/reference/`; `reference.ts` combines them with renderer metadata. Prompts under `packages/core/src/tools/prompts/` and the app chat/ACP prompt compose that reference rather than copying it. Run `bun run generate:authoring-reference` after changes; `check:authoring-reference` (part of `check:docs`) verifies the committed skill/docs copies. Do not edit generated reference files.
- Shared design workflow and on-demand UX, visual, design-system, creation, and review guidance live under `packages/core/src/tools/design-guidance/`; chat composes `DESIGN_WORKFLOW`, ACP continuation turns reuse its compact `DESIGN_COMPOSITION_GUIDANCE`, and MCP exposes `get_design_guidance`. Keep briefs and planning artifacts optional, and keep renderer syntax in the canonical authoring reference; `packages/core/tests/tools/design-guidance/`, `tests/app/ai/acp/prompt.test.ts`.
- The installable agent skill is maintained in `skills/open-pencil/`. Changes to agent-facing APIs, CLI/MCP behavior, or design authoring must update affected skill examples, prompts, and public documentation in the same change. Keep examples valid in their actual execution environment; do not advertise library exports as scripting globals unless exposed there. Prefer runtime discovery and canonical references over duplicated API/tool inventories.
- MCP-only tools and transports: `packages/mcp/AGENTS.md`. WebMCP registration and app completion: `src/AGENTS.md`.
- Original-image imports use a per-API host reader; the desktop binds native file access, and MCP resolves scoped paths before forwarding bytes to `set_image_fill`. Preserve encoded bytes and overlays instead of converting model previews into assets; `packages/core/tests/tools/image-file.test.ts`, `packages/mcp/tests/tool/image-file.test.ts`.

## Editor

`createEditor()` in `packages/core/src/editor/create.ts` assembles an `EditorContext` plus domain action modules for viewport, selection, pages, shapes, structure, components, clipboard, undo/history, text, variables, layout, color space, graph reads, and the tool registry. `Editor` is `ReturnType<typeof createEditor>`. Check the folder before adding behavior; keep new actions in the nearest domain module or folder instead of growing unrelated files. Modules share state through `EditorContext`, never through app code or Vue.

- All selection mutations go through `ctx.setSelectedIds()` and all tool changes through `ctx.setActiveTool()` so events fire consistently. App code uses editor actions such as `clearSelection()`, `select()`, or `setTool()`, never direct `state.selectedIds =` or `state.activeTool =` assignments.
- The editor exposes a typed nanoevents emitter. Event names and payloads live in `EditorEvents` in `packages/core/src/editor/types.ts`; graph events are bridged from SceneGraph by `packages/core/src/editor/graph-events.ts`. Subscribe with `editor.onEditorEvent(event, handler)`; in Vue use `useEditorEvent()` from `packages/vue/src/editor/events/use.ts`. UI that only cares about graph data should use editor events for incremental surfaces such as the layer tree instead of watching repaint-only state.
- Commands under `packages/core/src/editor/structure/` (group, boolean, container wrap, flatten) and `packages/core/src/editor/components/` are the canonical implementations of user actions. The Figma API, tools, and app call them or share their helpers; do not reimplement sizing, placement, or propagation elsewhere.
- Live property controls use selected-node projections from `packages/core/src/editor/selection-state/nodes.ts`: shallow reactive copies that receive `node:previewUpdated` patches at property granularity. Never add preview invalidation to all `useSceneComputed` consumers; catalogs and unrelated controls must not refresh for geometry previews. Projection subscriptions belong to the consuming scope or session and must be disposed.
- `prepareNumberProperty()` materializes shared corner/border storage only for an edit, preserving inherited instance sides; grouped callers include preparation and mutation in one binding transaction. `packages/core/tests/editor/numeric-property-groups.test.ts`.
- Numeric geometry edits own a `beginNodePreview()` handle with `update`, `commit`, and `cancel`. It captures all affected fields and layout children, publishes the complete delta once, and restores exact originals on cancellation. Selection, page, and graph changes and disposal cancel the old edit; trailing input must not target the new selection. Controls must close previews even when a gesture returns to its starting value.
- Rotation previews change through `setRotationPreview()` and `rotation:preview-changed`; cancellation must close the owning gesture without deselecting or committing it.
- Renderer interaction policy uses explicit `beginInteractiveEdit()` leases and `isInteractiveEditing()`, not undo batching. Release leases on every terminal path. Keep live queries callable across app facades that spread editor actions.
- `packages/core/src/editor/history/atomic-tool.ts` owns synchronous property/variable transactions for AI, MCP, and WebMCP tools; see Tools above.

## OpenPencil API

`OpenPencilAPI` (`packages/core/src/openpencil-api/`) is what OpenPencil adds to the Plugin API, exposed to scripts as the `openpencil` global next to `figma`.

- Keep `figma` Figma-shaped and put OpenPencil-only features on `openpencil`, in the same style: methods and node-like handles with getters and setters, not parallel helper functions. Never add non-Figma members to `FigmaAPI` (`compatibility.ts`).
- Script runners get both globals only through `compileScript` (`packages/core/src/tools/analyze/eval/wrap.ts`); the `eval` tool, `openpencil eval`, and app automation must not build their own `AsyncFunction`.
- Members take names, not internal ids, and write through the same scene-graph functions the editor's actions use, such as `behaviourFromSpec`; errors name what exists. Tools for the same feature wrap the `openpencil` API rather than reimplementing it (`packages/core/src/tools/create/behaviours.ts`).
- A new member updates `packages/docs/programmable/cli/scripting.md` and the agent skill in the same change; tests drive it as scripts do, through `compileScript` (`packages/core/tests/openpencil-api/`).

## Renderer

Canvas is CanvasKit (Skia WASM) on a WebGL surface, not DOM.

### Invalidation

- `renderVersion` tracks repaints, `canvasVersion` invalidates scene drawing, and `sceneVersion` tracks all document changes. `requestRender()` bumps all three, `requestRepaint()` only `renderVersion`, and `requestRefresh()` only `sceneVersion` and its refresh event; views and collaboration follow document changes without forcing a canvas redraw (`packages/core/src/editor/create.ts`).
- `renderNow()` is only for surface recreation and font loading, where an immediate draw is required.
- The resize observer uses a rAF throttle, not a debounce; debounce causes canvas skew.
- Viewport culling skips off-screen nodes; unclipped parents are not culled because children may extend beyond bounds.
- Overscan images accelerate navigation; settled scenes rasterize existing retained pictures at the live viewport size and origin. Pixel-grid alignment alone does not guarantee Skia anti-aliasing parity. Keep settlement pending until the viewport pass completes; do not add a second viewport image cache.

### Paints

- A gradient or image paint builds a Skia shader through `applyGradientFill` and `applyImageFill` (`packages/core/src/canvas/fills.ts`), which take the target `Paint`, so a stroke reuses them instead of a second shader path.
- `forVisibleStrokes` (`packages/core/src/canvas/scene.ts`) is where a stroke's shader is set and cleared; stroke draw helpers take an already-configured `strokePaint` and must not reset its shader.

### Caches

- Bounded rendering caches share `packages/core/src/cache/resource.ts` for recency, count/weight accounting, and removal disposal. Domain adapters own keys, font/page/dependency invalidation, and sizing units; use non-touching `peek()` for FIFO or planning reads. Rejected insertions leave ownership with the caller.
- Independent foreground-blur rasters are interaction previews: prepare them while idle, reuse them during movement, and bypass them for settled drawing, exports, backdrop-dependent effects, and live rotation. Size previews must reject an image of the old dimensions even when node-picture invalidation is deferred (`packages/core/tests/canvas/renderer/foreground-blur.test.ts`).
- Keep weak memos, async request registries, pools, and dependency-owned picture/path maps on their distinct lifetime policies.
- Paragraph construction is typed against `packages/core/src/canvas/text/paragraph/inputs.ts`; the same inputs drive preparation-cache invalidation. Add a mutation case when extending that contract. Drawing borrows native paragraphs; the renderer owns their bounded cache and destruction.
- Text lays out through `buildParagraph` into a `TextLayout` (`packages/core/src/canvas/text/layout/`): one native paragraph for plain text, or one per paragraph with its list indent, marker, and spacing, since Skia has no hanging indent. Drawing, measurement, the text editor, saved glyphs (`shapeText`), and text outlines all read that layout rather than laying text out again (`packages/core/tests/canvas/text/lists.test.ts`).

### Text decorations

- Underlines and strikethroughs come from `textDecorationRects` (`packages/core/src/canvas/text/decorations.ts`), Figma's geometry over laid-out or saved glyphs, both for drawing and for the rects `.fig` files save, which Figma draws decorations from; Skia's paragraph decorations stay off. Drawn decorations are kept with the prepared text, whose paragraph inputs cover them, or by saved glyphs in the renderer's `derivedDecorationCache` (`packages/core/tests/canvas/text/decorations.test.ts`).

### Geometry and overlays

- Use `@open-pencil/core/geometry` for world/screen transforms, inverses, bounds, and handle placement instead of interpreting ancestor rotations or reflections independently.
- Label drawing and hit testing share `packages/core/src/canvas/labels/{layout,transform,style}.ts`, including paragraph measurements and unreflected label axes.
- Selection border width is constant regardless of zoom: divide by scale. Section and frame title text never scales: render at a fixed font size and ellipsize to fit.
- Rulers are rendered on the canvas with selection range badges that do not overlap tick numbers. Remote cursors are Figma-style colored arrows with a white border and name pill, rendered in screen space.

### Visual coverage

Pixel-affecting features need committed visual coverage, not only mock or geometry assertions. Add or update a Playwright canvas snapshot for changes to fills, gradients, images, blend modes, masks, boolean geometry, corners, strokes, shadows, blur, text rendering, or demo showcase scenes. Use targeted updates such as `bun run test tests/e2e/canvas/fill-modes-visual.spec.ts --update-snapshots`, then rerun the same test without `--update-snapshots`.

## Figma API

`FigmaAPI` mimics Figma's Plugin API over the SceneGraph. `openpencil eval`, the AI and MCP tools, and the app bind to it. Tests live under `tests/engine/figma/api/` and mirror the API surface.

- **Shape follows Figma.** Match `@figma/plugin-typings` at the version pinned in the root `package.json`. `packages/core/src/figma-api/compatibility.ts` type-checks the supported surface against `PluginAPI`; add every new member to `SupportedPluginAPI` there. Model unsupported members explicitly rather than approximating them.
- **Behavior follows Figma.** Read the Plugin API documentation for the member, and for anything observable (geometry, ordering, defaults, errors) run the same script in live Figma and record the observed result in the test. `figma-use` and `tests/figma/` are the live oracle; `tests/fixtures/figma-oracles/` holds recorded values.
- **User actions are shared code.** When an editor command does the same thing (group, ungroup, boolean, flatten, instance creation, component sync), call the implementation under `packages/core/src/editor/` or its shared helper. Do not reimplement geometry, placement, or propagation here; new geometry helpers belong in Scene Graph.
- Geometry getters lay out what the graph's edits touched since the last read, as Figma does, through `flushPendingLayout` in `packages/core/src/figma-api/pending-layout.ts`; a new geometry getter calls it first (`packages/core/tests/figma-api/pending-layout.test.ts`).
- Node proxies live in `packages/core/src/figma-api/proxy.ts` and `packages/core/src/figma-api/accessors/`; per-character text styles are modelled in `packages/core/src/text/character-style.ts`, which the editor's selection styling shares, and read for scripts in `packages/core/src/figma-api/text/style.ts`, which node getters, range methods, and segments all use (`packages/core/tests/figma-api/text/styles.test.ts`); `packages/core/src/figma-api/render-bounds.ts` implements Figma's `absoluteRenderBounds` semantics and is the only geometry that is Figma-specific.
- `packages/core/src/figma-api/index.ts` stays under the 600-line limit by moving whole domains into sibling modules such as `components.ts` and `text/`, not by extracting generic helpers into this folder.
