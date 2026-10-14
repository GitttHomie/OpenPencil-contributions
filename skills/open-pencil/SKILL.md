---
name: open-pencil
description: Work with Figma .fig design files and the running OpenPencil editor — inspect structure, query nodes, analyze design tokens, export PNG/SVG/PDF/JSX, and modify designs programmatically. Use when asked to open, inspect, export, analyze, or edit .fig files, or to control the running OpenPencil app.
---

# OpenPencil

Use frames and components for layout surfaces and photo containers. Full-card photos belong in the card frame's image fill, with scrims as additional fills above the image and text as children. Placeholder icons may sit inside photo frames. Reserve shapes for graphics and illustrations.

For images produced in another application, use `import_image` with the original final render's path and target frame ID. The file must be inside the MCP root; have the producing application save there if necessary. Verify the returned source path, byte count and image hash. Never substitute screenshots, thumbnails, or Base64 copied from model vision. If original-file import is unavailable, explain the limitation instead.

OpenPencil provides a CLI and MCP server for `.fig` design files and the running OpenPencil editor.

Use two modes:

- **App mode** — connect to the running OpenPencil editor by omitting the file argument.
- **Headless mode** — work with `.fig` files directly by passing a file path.

```bash
# App mode — operates on the document open in the editor
openpencil tree

# Headless mode — operates on a .fig file
openpencil tree design.fig
```

Use `openpencil --help`, per-command help, and the connected MCP server’s tool schemas to check the installed version’s capabilities. See the [CLI reference](https://openpencil.dev/reference/cli) and [MCP guide](https://openpencil.dev/programmable/mcp-server) for current documentation.

## Design guidance

Work directly from the user's request. Briefs, PRDs, questionnaires, and stage approvals are optional; do not require them before designing. Make reasonable assumptions and scale the process to the task.

For substantial design work, use the MCP `get_design_guidance` tool when available. It returns the shared workflow and accepts `topics`, an array containing relevant entries from `ux`, `visual`, `design-system`, `creation`, and `review`. Load `design-system` and `creation` before composing repeated UI for a new interface; add `ux` when creating a product flow. Omit topics to discover the catalog. The guidance is bundled and requires no external skills or scripts.

Load `creation` when working with exposed component properties, customizable slots or layered/gradient paints. It maps the current authoring tools to those workflows. Inspect `get_component_properties` before changing defaults or instance overrides; use `set_paint` for an indexed fill/stroke edit that retains the rest of the stack. Follow the connected schemas rather than guessing arguments.

Inspect and reuse the current document's foundations. For new work, reason through the user task, establish the necessary variables and reusable components, then compose screens from linked instances. Small edits should proceed directly. If guidance retrieval is unavailable, follow this workflow and the authoring reference below using supported tools; do not install another skill or scaffold an app to complete a canvas task.

For variable-based text styles, follow the `design-system` guidance: create the requested typography variables first, bind the authoring text, then create the styles. Verify the definitions and apply them to initially unbound text; tokenized samples alone do not prove that the styles contain those bindings. Use only supported style-authoring APIs.

Use atomic composition at the scales the task needs: bound tokens, small controls, reusable patterns, sections, and screens. Shared controls inside larger components remain nested instances of the same main definitions. For example, Service card instances can have different content while their nested buttons all reference Button. Expose content differences through properties, swaps or slots instead of creating a definition per title or icon. Validate one representative composition before repeating it, including nested component links, bindings and preserved overrides. Ordinary text, illustrations and one-off page layouts do not need a component wrapper; there is no fixed style, component quota or mandatory five-stage process.

Keep instances connected when changing content or icons. Use exposed properties, variants, instance swaps, or slots; extend the main component if it lacks the needed control. Do not detach, flatten, or replace instances with unlinked copies to bypass protected structure. Detach only at the user's explicit request. Verify component links and instance-specific choices as well as appearance.

Inherit the component's Fixed, Hug, and Fill settings when creating instances. Omit numeric width and height unless the requested design requires an explicit override. Change content through exposed properties and let auto-layout resize; do not fix an instance to the main component's current measurements or compensate for stale bounds with arbitrary dimensions.

An instance can Fill a surrounding auto-layout frame even when its main component is Fixed. Size the surrounding frame and set the instance to Fill on the required axis; Fill contents inside the instance stretch with it. Preserve the main definition and the other axis, and ensure the surrounding layout independently establishes the available size.

Recurring corner smoothing can use `bind_variable` with field `cornerSmoothing` and a FLOAT variable. Values are unit fractions (`0.6` means 60%); keep them between 0 and 1. Bindings survive component reuse and OpenPencil save/reopen.

In `eval` scripts, use `layoutSizingHorizontal` and `layoutSizingVertical` for per-axis Fixed, Hug, or Fill. Fill requires a child in an auto-layout parent's flow; excluded children cannot fill. Geometry reads apply pending layout first, so a Hug parent's width or height can be inspected immediately after an edit.

## Requirements

```bash
# CLI
bun add -g @open-pencil/cli

# Optional standalone MCP server and stdio bridge
bun add -g @open-pencil/mcp
```

The desktop app starts `openpencil-mcp-http` automatically in production Tauri builds when `@open-pencil/mcp` is installed globally and exposes automation on:

- HTTP/RPC: `http://127.0.0.1:7600`
- WebSocket bridge: `ws://127.0.0.1:7600`
- MCP Streamable HTTP: `http://127.0.0.1:7600/mcp`

## CLI Commands

```bash
openpencil --help
```

Common commands:

- `info` — document overview: pages, node counts, fonts
- `tree` — print hierarchy with types and sizes
- `pages` — list pages
- `node` — detailed node properties by ID
- `selection` — current selection from the running app
- `find` — find nodes by name/type
- `query` — XPath selectors for node search
- `variables` — list variables and collections
- `tokens` — variables as a CSS custom-property stylesheet, a Tailwind v4 theme, or W3C design token files (`--format dtcg --out <folder>`)
- `export` — export PNG/JPG/WEBP/SVG/PDF/JSX/.fig
- `convert` — convert between supported document formats
- `analyze` — colors, typography, spacing, repeated clusters
- `lint` — consistency, structure, and accessibility checks
- `formats` — supported document/export formats
- `eval` — execute JavaScript with the Figma Plugin API
- `tool` — list, describe, and call any MCP tool from the shell, in app or headless mode
- `documents` — list, open, create, save, close, and activate documents in the running app
- `undo` / `redo` — step back through your own (automation) changes in the running app
- `settings` — read and change editor settings in the running app

### Inspect

```bash
openpencil info design.fig
openpencil tree design.fig
openpencil tree --page "Components" --depth 3  # app mode
openpencil pages design.fig
openpencil node design.fig --id 1:23
openpencil node --id 1:23  # app mode
openpencil selection --json
openpencil variables design.fig
openpencil variables --collection "Colors" --type COLOR
openpencil tokens design.fig --format tailwind > theme.css
openpencil tokens design.fig --format dtcg --out tokens  # W3C design tokens; import_design_tokens reads them back
```

### Search and XPath query

```bash
openpencil find design.fig --name "Button"
openpencil find --type FRAME                          # app mode
openpencil find design.fig --type TEXT --page "Home"
openpencil find design.fig --name "Card" --type COMPONENT --limit 50

openpencil query design.fig "//FRAME"
openpencil query design.fig "//FRAME[@width < 300]"
openpencil query design.fig "//TEXT[contains(@name, 'Button')]"
openpencil query design.fig "//COMPONENT[@stackMode]"
openpencil query design.fig "//COMPONENT//FRAME//TEXT"
openpencil query "//FRAME[@width > 1000]"             # app mode
```

Common node types: `FRAME`, `TEXT`, `RECTANGLE`, `ELLIPSE`, `VECTOR`, `GROUP`, `COMPONENT`, `COMPONENT_SET`, `INSTANCE`, `SECTION`, `LINE`, `STAR`, `POLYGON`, `SLICE`, `BOOLEAN_OPERATION`.

### Export and convert

```bash
openpencil export design.fig -o hero.png
openpencil export -o hero.png                         # app mode
openpencil export design.fig --node 1:23 -s 2 -o button@2x.png
openpencil export design.fig -f jpg -q 85 -o preview.jpg
openpencil export design.fig -f svg --node 1:23 -o icon.svg
openpencil export design.fig -f pdf -o page.pdf
openpencil export design.fig -f fig -o roundtrip.fig
openpencil export design.fig -f jsx -o component.jsx
openpencil export design.fig -f jsx --style tailwind -o component.tsx
openpencil export design.pen -f storybook -o src/stories --watch  # stories + design images per component, re-exported on save
openpencil export 'src/**/*.pen' -f storybook --beside  # stories next to each design file
openpencil export design.fig --thumbnail --width 1920 --height 1080
openpencil export --page "Components" -o components.png

openpencil convert design.fig -o design.pen
openpencil formats
```

### Analyze and lint

```bash
openpencil analyze colors design.fig
openpencil analyze colors --similar --threshold 10     # app mode
openpencil analyze typography design.fig --group-by size
openpencil analyze spacing design.fig --grid 8
openpencil analyze clusters design.fig --min-count 3
openpencil lint design.fig
openpencil lint design.fig --json
openpencil lint design.fig --fix -o fixed.fig     # bind matching color variables, round to whole pixels
```

In MCP and AI chat, `lint` lists findings with their `fix` and `suggestions`; `lint_fix` applies the safe fixes, and the first suggestion of each finding with `suggestions: true`.

### Eval (Figma Plugin API)

Execute JavaScript against the document using a Figma Plugin API-compatible runtime:

```bash
openpencil eval design.fig -c 'figma.currentPage.findAll(n => n.type === "TEXT").length'

# App mode — modifies the live document in the editor
openpencil eval -c '
  const buttons = figma.currentPage.findAll(n => n.name === "Button");
  buttons.forEach(b => { b.cornerRadius = 8 });
  buttons.length + " buttons updated"
'

# Modify and save to the same file
openpencil eval design.fig -w -c '
  const texts = figma.currentPage.findAll(n => n.type === "TEXT");
  texts.forEach(t => { t.fontSize = 16 });
'

# Save to a different file
openpencil eval design.fig -o modified.fig -c '...'

# Read code from stdin
echo 'figma.currentPage.children.map(n => n.name)' | openpencil eval design.fig --stdin

# Style part of a text, and read how it is styled
openpencil eval design.fig -w -c '
  const title = figma.currentPage.findOne(n => n.type === "TEXT" && n.name === "Title");
  title.setRangeFontName(0, 5, { family: "Inter", style: "Bold" });
  title.setRangeFills(0, 5, [{ type: "SOLID", color: { r: 0.9, g: 0.1, b: 0.1 } }]);
  title.getStyledTextSegments(["fontName", "fills"]).map(s => [s.characters, s.fontName.style])
'
```

Text styles follow Figma's per-character model: `getStyledTextSegments(fields)` reads runs, `getRange…`/`setRange…` read and set font, size, fills, letter spacing, line height, decorations, text case, hyperlinks, text and fill style IDs, and bound variables for `[start, end)`, and a text's `fontSize`, `fontName`, `fills`, and similar read `figma.mixed` while characters differ. Check for it before using the value.

For existing number or Boolean tokens, use `openpencil.setVariableFormula(collectionName, variableName, source, modeName?)` in `eval`: for example, `openpencil.setVariableFormula("Tokens", "spacing/md", "{spacing/base} * 2")` or `openpencil.setVariableFormula("Tokens", "visible", "{enabled} AND NOT {busy}")`. It validates references, types, cycles and finite results before writing, returns the calculated value, and defaults to the collection's default mode. References use names (or `{Collection::variable/name}`) and persist by ID. Arithmetic supports `+ - * /`, unary signs and parentheses; Boolean precedence is `NOT`, `AND`/`NAND`, `XOR`, `OR`/`NOR`. Numeric operands use stored units, including px for lengths. Keep layers bound to these tokens instead of copying their current results into each layer.

Next to `figma`, scripts get `openpencil`: what OpenPencil adds to the Figma API, in its style. A main component can behave as a Reka UI control, by its own property and slot names:

```bash
openpencil eval design.fig -w -c '
  const set = figma.currentPage.findOne(n => n.type === "COMPONENT_SET" && n.name === "Switch");
  const thumb = set.findOne(n => n.name === "Thumb");
  const behaviour = openpencil.setBehaviour(set, "switch")
    .bindValue("value", "State")      // On/Off guessed from the variant values
    .bindPart("thumb", thumb);        // the frame becomes a slot
  behaviour.states = "Interaction";
  behaviour.missing                    // [] when the control is complete
'
```

`openpencil.behaviourKinds` lists every kind with its values and parts; `openpencil.getBehaviour(node)` reads one (a variant reads its set's); `openpencil.createSlot(frame)` makes a frame a slot. The `set_behaviour`, `get_behaviour`, and `create_slot` tools do the same over MCP, and design JSX writes controls with Reka's element names (`Switch.Root`, `Switch.Thumb`).

Comments people leave on the canvas are review feedback you can act on. Read the open ones, change the design, then answer and resolve each, naming yourself as the author:

```bash
openpencil eval design.fig -w -c '
  openpencil.getComments({ resolved: false }).map(c => ({ id: c.id, text: c.text, layer: c.node?.name }))
'
# after the change:
openpencil eval design.fig -w -c 'openpencil.getComment("c_…").reply("Title is 24px now", { author: "Claude" }).resolve()'
```

`openpencil.addComment(text, { node, page, x, y, author })` leaves a new one. Over MCP the same is `get_comments`, `add_comment`, `reply_to_comment`, and `resolve_comment`. Comment text is Markdown.

### Diff

Compare nodes and documents, and apply patches:

```bash
openpencil diff create design.fig --from 1:23 --to 1:87       # JSX attribute patch
openpencil diff jsx design.fig --from 1:23 --to 1:87          # JSX structure
openpencil diff show 1:24 design.fig --attributes 'rounded={8}' > fix.diff
openpencil diff apply fix.diff design.fig --dry-run           # fails on stale values
openpencil diff apply fix.diff design.fig --write
openpencil diff visual design.fig --from 1:23 --to 1:87 -o diff.png
openpencil diff files before.fig after.fig                    # exit 1 when different
```

### Control the running app

```bash
openpencil documents list --json                       # tab IDs, paths, pages
openpencil documents open designs/landing.fig          # new tab; --json returns target.documentId
openpencil documents new --path designs/draft.fig
openpencil documents activate tab-123 --page-id 0:4    # bring a tab to the front
openpencil documents save --document-id tab-123
openpencil documents close --document-id tab-123 --save   # or --discard; fails on unsaved changes otherwise
openpencil undo --document-id tab-123                  # also: redo
openpencil settings get --json
openpencil settings set editing.snapping.pixelGrid false
```

`tool` exposes every MCP tool, so the CLI is never limited to its dedicated commands:

```bash
openpencil tool list
openpencil tool describe set_fill                      # JSON Schema for the arguments
openpencil tool call set_fill --document-id tab-123 --args '{"id":"0:5","color":"#2563eb"}'
openpencil tool call create_page design.fig --args '{"name":"Icons"}' --write   # headless
```

Every command that reports structured data supports `--json` when appropriate.

## MCP Server

The desktop app bundles its HTTP helper and runtime. Do not install a global MCP helper to repair desktop canvas setup: check **Settings → MCP**, restart the helper, or reinstall the complete app if its bundled executable is missing. HTTP agents connect to `http://127.0.0.1:7600/mcp` with the local discovery token.

### Stdio MCP clients

Use Bun by default:

```json
{
  "mcpServers": {
    "open-pencil": {
      "command": "bunx",
      "args": ["openpencil-mcp"]
    }
  }
}
```

If `@open-pencil/mcp` is installed globally, direct binaries also work:

```json
{
  "mcpServers": {
    "open-pencil": {
      "command": "openpencil-mcp"
    }
  }
}
```

### HTTP / Streamable HTTP

```bash
export PORT=7600
export OPENPENCIL_MCP_ROOT=/path/to/files     # explicitly limit filesystem access

openpencil-mcp-http
# or: bunx openpencil-mcp-http
```

Authentication is enabled by default with an automatically generated token. `OPENPENCIL_MCP_AUTH_TOKEN` can supply an explicit non-empty token; an empty value disables authentication. If browser access needs CORS, set `OPENPENCIL_MCP_CORS_ORIGIN` to a trusted origin. Never combine wildcard CORS (`*`) with disabled authentication.

The CLI defaults the filesystem root to the home directory on Windows and the current working directory elsewhere. Set `OPENPENCIL_MCP_ROOT` to an explicit narrow directory rather than relying on that default.

### MCP workflow

1. **Find or open a document** — `list_documents` for open tabs and their IDs; `open_file { path }` within the effective filesystem root, or `new_document {}`. Pass `document_id` and `page_id` explicitly instead of relying on the active tab; `activate_document { document_id }` brings a tab to the front when the user should see it.
2. **Query** — `get_page_tree`, `find_nodes`, `query_nodes`, `get_node`, `list_pages`, `get_current_page`.
3. **Inspect** — `get_jsx`, `diff_jsx`, `diff_create`, `diff_visual`, `describe`, `export_image`, `export_svg`, `export_pdf`.
4. **Modify** — `render`, `batch_update`, `update_node`, `set_fill`, `set_layout`, `create_shape`, `import_svg`, etc.
5. **Navigate** — after creating or editing visible canvas content, call `select_nodes` and `viewport_zoom_to_fit { id }` (or `node_bounds` + `viewport_set`) so the user can see the result in the running editor.
6. **Save/export** — `save_file`, `export_image`, `export_svg`, `export_pdf`, or CLI `export`.
7. **Close** — `close_file { document_id, unsaved }` closes a document tab after the workflow. With unsaved changes it fails unless `unsaved` is `"save"` or `"discard"`; automation never prompts in the app.

Use `undo` / `redo { document_id }` to step back your own changes. They refuse when the newest step was made by the user in the editor; never work around that. `get_settings` and `update_settings { settings }` read and change editor preferences such as theme, language, and snapping; they never expose credentials, models, or tool access.

### Browser-native WebMCP (experimental)

WebMCP is off by default. In **Settings → MCP → WebMCP**, choose **Inspect** for read-only tools or **Edit** for scoped changes. These controls are independent of local MCP settings. Supporting browsers expose inspection and undoable existing-layer/property and variable edits directly from the OpenPencil workspace through `document.modelContext`, without an MCP server connection. Discover this browser surface separately: it excludes structural creation/deletion, arbitrary JS/JSX execution, external assets, filesystem operations, and credentials.

Calls capture the active document/page. Cancellation prevents an edit from starting but does not reverse an already committed edit; use editor undo instead. Atomic edits require at most 10,000 nodes and variables combined, including when these same tools run through app AI/MCP. See the [WebMCP guide](https://openpencil.dev/programmable/mcp-server#webmcp) for scope and browser requirements.

## Tool discovery

Users configure local server tools in **Settings → Tool access** → **Local MCP**, independently from **Built-in AI** tool preferences. Local MCP changes require a server restart and stdio client reconnection; built-in AI changes apply to the next message. ACP and Pi agents use the MCP surface, not the direct-model AI tool selection. Tool switches are not a sandbox: enabled scripting tools can still perform operations whose dedicated tools are disabled.

Discover available tools and their arguments from the connected server or browser; availability varies by version and mode. Each tool's schema and execution/exposure metadata are authoritative. Numeric inputs accept numbers or numeric strings consistently, but reject non-finite values. Do not rely on a fixed tool count or a copied inventory.

> Tool availability can depend on server mode. `open_file`, `save_file`, and disk-writing export paths are scoped to the effective filesystem root; set it explicitly with `OPENPENCIL_MCP_ROOT`.

## Key tools for agents

- **`query_nodes`** — XPath selectors to find specific nodes without fetching the full tree.
- **`get_jsx`** — inspect any node as JSX in the same format accepted by `render`.
- **`diff_jsx` / `diff_create`** — compare two nodes as a JSX line diff or as an appliable patch of JSX attributes; `diff_show` previews setting attributes and `diff_apply` applies a patch only if the nodes still match it.
- **`diff_visual`** — pixel diff between two rendered nodes; use it to confirm an edit changed only the intended region.
- **`describe`** — semantic analysis of role, visual style, layout, and design issues.
- **`batch_update`** — apply multiple node updates efficiently.
- **`export_image` / `export_svg` / `export_pdf`** — visual verification and deliverables.
- **`viewport_zoom_to_fit` / `viewport_set` / `viewport_get`** — keep the live editor focused on the created or edited design.
- **`get_codegen_prompt`** — retrieve OpenPencil's current JSX/codegen guidance.
- **`undo` / `redo`** — revert or reapply your newest change; they refuse to touch the user's edits.
- **`list_documents` / `activate_document`** — discover open tabs and show the one you worked on.

## JSX Rendering

Read [Design authoring](references/design-authoring.md) before creating or modifying JSX designs. This bundled reference is generated from Core's authoring guidance, tested examples, and renderer metadata—the same reference used by chat and codegen prompts.

Use the `render` tool for JSX strings. Use only the APIs exposed by the installed `eval` environment; native library exports are not automatically scripting globals. The connected server's `get_codegen_prompt` provides its version's codegen and authoring guidance.

## Tips

- Omit the file path to work with the document open in the running OpenPencil editor.
- Start with `info` or `get_page_tree` to understand the document.
- Use `tree --depth 2` or `query_nodes` to avoid overwhelming output on large files.
- Export specific nodes with `--node` for faster visual checks.
- Use `export_image` after changes to verify visual quality.
- Search `get_components` by semantic name to discover components on unopened document pages. Test a content override on one linked instance before repeating a composition; stop dependent calls if a document-wide failure blocks that edit.
- Use `get_components` with `include_variants: true` for direct variant IDs and sizes. Find spacing tokens with `find_variables { query: "spacing", type: "FLOAT", compact: true }`; use the library's naming, and narrow truncated results instead of repeatedly requesting the whole catalog.
- Batch shared property changes with `set_font { ids: ["…", "…"], family: "Inter", size: 16 }` or other property tools. Use `items` with complete per-item arguments when values differ, and native arrays for mixed edits: `batch_update { operations: [{ id: "…", props: { text: "Local recording" } }] }`. Batches accept up to 200 items and roll back on failure; correct the reported item before retrying. Reorder existing sections with `reparent_node { id: "…", parent_id: "…", index: 1 }`; do not replace populated instances merely to change their position.
- Use `analyze_spacing { id: "…" }` on the finished screen. It reports adjacent box gaps and inner content-box gaps, including wrapper whitespace; these are geometry measurements, not painted-pixel distances. Supply `grid` only when this design system establishes one; `describe` also skips grid checks unless requested.
- Take a full-screen verification image after the final edit, then detail images where needed. A detail image alone does not verify the whole page. Chat previews may reduce resolution to fit the response budget; use `path` with the requested `scale` and `maxEdge` for a file deliverable. Treat existing library copy as sample content, not evidence of product capabilities.
- After creating a visible design, select it and zoom the editor to it: `select_nodes { ids: [id] }` then `viewport_zoom_to_fit { id }`.
- If zoom-to-fit is unavailable in a client, use `node_bounds` to calculate the center and call `viewport_set { x, y, zoom }`.
- Use `analyze colors --similar` to find near-duplicate colors.
- Use `openpencil tool call` for MCP tools without a dedicated CLI command, and `eval` for Figma Plugin API operations not covered by any tool.
- Use `--json` when piping CLI output to scripts.
- In app mode, `eval` and MCP modifications are reflected live in the editor.

Create related tokens with `create_variable {items:[{name:"space/md",type:"FLOAT",collection_id:"…",value:16},{name:"enabled",type:"BOOLEAN",collection_id:"…",value:true}]}`. Bind a shared token with `bind_variable {ids:["…","…"],field:"itemSpacing",variable_id:"…"}`; use `items` when fields or variables differ. Use `import_design_tokens` for whole token files with collections, modes and aliases.

Create repeated content with `create_instance {items:[{component_id:"…",parent_id:"…",sizing_horizontal:"FILL",values:{"property-id":"First label"}},{component_id:"…",parent_id:"…",sizing_horizontal:"FILL",values:{"property-id":"Second label"}}]}`. Read stable property IDs with `get_component_properties` first. Omitted sizing preserves the component definition. Batch later overrides with `set_instance_properties` using shared `ids` or distinct `items`; keep the instances connected. Component-property creation, editing, deletion and binding also accept batches.

Inspect related targets with `get_node {ids:["…","…"]}`, `get_component_properties`, `node_bounds`, `node_bindings`, `get_variable`, `get_collection`, or `analyze_spacing`. Bulk reads return indexed results and per-item errors within a 48,000-character budget; retry omitted or oversized targets with smaller scopes. Batch `get_node` defaults to depth 0 and `node_tree` to depth 1; single-target defaults stay unchanged.
