---
title: Variables
description: Design variables, collections, modes, and fill bindings in OpenPencil.
---

# Variables

Variables store reusable design tokens — colors, spacing values, and other properties — that can be bound to nodes. Change a variable's value and every node using it updates.

## Opening the Variables Dialog

Open it from **View → Variables…**, by searching "Variables" in the command palette, or, with no nodes selected, from the Variables section of the Design tab. **Expand** in the dialog's corner gives it most of the window.

The dialog lists the active collection's variables on the left, edits the selected variable or the collection on the right, and shows the stylesheet they produce below. In a narrow window or on a phone it shows one mode at a time, and a variable, the collection settings, or the stylesheet opens over the list with a back button.

## Collections

Variables are organized into collections. In a wide dialog they are listed in a sidebar with how many variables each holds; narrower, they are tabs, or a menu on a phone.

- **Switch collection** — click it in the sidebar or its tab
- **Create collection** — click **+** next to Collections, or the folder button in the toolbar
- **Rename or delete** — with no variable selected, the right side edits the collection: change its name, or delete it from the **⋯** menu next to the name
- **Switch attribute** — the attribute that turns manually switched modes on, `data-theme` by default for a collection named Theme; type another name, such as `data-color-scheme`, to match an existing codebase

## Modes

Each collection can have multiple modes (e.g., Light and Dark). Modes appear as value columns in the list, and a variable has a value for each mode. Manage them in the collection settings:

- **Add mode** — click **+** next to Modes
- **Rename** — edit the mode's name
- **Duplicate, set as default, delete** — use the **⋯** menu next to the mode

The default mode is **Always on** and goes in `:root`. Every other mode has **Applies when**, which says when the mode takes over in the exported stylesheet; the CSS it writes is shown underneath:

| Applies when                                                         | CSS                                                                                                                 |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| **Switched manually**                                                | the collection's switch attribute set to the mode, such as `[data-theme="dark"]` for a Theme collection's Dark mode |
| **System is in dark mode** / **System is in light mode**             | `@media (prefers-color-scheme: dark)` / `light`                                                                     |
| **High contrast is on**                                              | `@media (prefers-contrast: more)`                                                                                   |
| **Reduced motion is on**                                             | `@media (prefers-reduced-motion: reduce)`                                                                           |
| **Screen is narrower than** / **Screen is wider than** a width       | `@media (max-width: 640px)` / `min-width`                                                                           |
| **Container is narrower than** / **Container is wider than** a width | `@container (max-width: 640px)` / `min-width`                                                                       |
| **Custom CSS**                                                       | any selector, or a `@media`, `@supports`, or `@container` query                                                     |

On the canvas, a layer shows a mode when you set the layer to it, whatever the condition. In exported code, a manually switched mode is turned on by adding its attribute to an element, so layers set to it export with that attribute. Layers set to a mode with any other condition, custom selectors included, export with literal values instead of tokens, because the stylesheet, not the layer, decides when that mode applies.

## Managing Variables

Variables are grouped by the folders in their names (`Brand/Primary` appears as _Primary_ under _Brand_), with their CSS name and one value per mode.

- **Create variable** — click **Create variable** (or **+**) and pick a type; the new variable opens for editing
- **Select** — click a row, or move with the arrow keys and press Enter. Shift-click selects a range, and Cmd-click (Ctrl-click on Windows and Linux) adds or removes one
- **Filter** — type in the search bar to filter by name, CSS name, description, or value, such as `--color-brand`, a hex color, or the variable an alias points at, forgiving typos as the command palette does; click a group in the sidebar to show only that group and the groups inside it, or use the filter button to show only some types
- **Rename or edit in place** — double-click a name, or a number or text value, in the list
- **Right-click** — rename, duplicate, move to a group (or a new one), or delete the selected variables; Delete or Backspace deletes them too
- **Reorder** — drag a row; the order is kept in the file
- **Several selected** — the right side moves them into a group, duplicates them, or deletes them
- **Undo and redo** — Cmd+Z and Cmd+Shift+Z or Cmd+Y (Ctrl on Windows and Linux) work in the dialog as on the canvas, one step per change. Enter commits a field and returns to the list; while a field has text you have not committed, Cmd+Z undoes the typing

Selecting a variable edits:

- **Name** and **CSS name** — leave the CSS name empty to derive it from the name and scopes, such as `--color-brand-primary`. Type the name without its `--`; a name CSS cannot use is flagged and not saved
- **Unit** — for numbers, `px`, `rem`, `%`, `ms`, `s`, `deg`, or none; values are entered in that unit
- **Value** (or **Values**, one per mode) — a color opens the color picker. The variable button next to a value points it at another variable of the same type, an alias that follows that variable; **Detach variable** turns it back into the value it showed
- **CSS expression** — for numbers, a value such as `clamp(1rem, 4vw, 1.5rem)` written instead of the number in CSS, while the canvas keeps drawing the number
- **Scopes** — which properties the variable is offered for
- **Description**
- **Hide from publishing** — files that use this one as a library do not see the variable

## Stylesheet

The bottom of the dialog shows the active collection as CSS custom properties. The copy button copies the whole document's variables as CSS or as a Tailwind v4 theme, so aliases to other collections resolve.

## Importing and Exporting Design Tokens

Variables and styles move between OpenPencil, Figma, and code as [W3C design tokens](https://www.designtokens.org/):

- **Export:** in the stylesheet's copy menu, choose **Export as design tokens**. The zip holds one file per collection mode, which Figma imports as a mode; text and effect styles as typography and shadow tokens; and a resolver that combines them for tools such as Style Dictionary
- **Import:** click **Import design tokens** in the toolbar and pick token files or a zip. Files from Figma, a resolver with the files it names, and Tokens Studio themes all work
- **Choose where it goes:** before anything changes, the dialog shows each collection and mode it found and where it goes: a new collection or mode, an existing one, or nowhere. Variables and styles with the same name are updated and the rest is added; nothing is deleted. It counts what will be added, updated, and skipped, and lists why each skipped token was left out
- The import is one step: **Undo** takes it all back

## Binding Variables to Fills

In the Fill section of the properties panel, use the variable picker to bind a color variable to a node's fill.

- **Bind** — select a color variable from the picker. The fill shows a purple badge with the variable name.
- **Detach** — click the detach button on the badge to remove the binding. The fill reverts to the resolved color value.

When the variable's value changes (or when switching modes), all bound fills update automatically.

## Numeric and Boolean formulas

Select a number or Boolean variable and edit its **Value** field. The same field accepts a literal,
a reference such as `{spacing/base}`, or a formula such as `{spacing/base} * 2`. References appear
as removable pills with their name and resolved value; operators and numbers remain editable
around them. The picker shows resolved values for the edited mode and inserts a reference at the
cursor. Copying a formula retains its reference syntax. Press Enter or leave the field to save; Escape restores the saved text,
and invalid drafts leave the document unchanged. Replace the source with a literal to disconnect it.

- Numbers support `+`, `-`, `*`, `/`, unary signs and parentheses: `{spacing/base} * 2`.
- Booleans support `AND`, `OR`, `NOT`, `XOR`, `NAND`, `NOR`, parentheses, and `true`/`false`:
  `{state/enabled} AND NOT {state/busy}`. `NOT` binds first, then `AND`/`NAND`, then `XOR`,
  then `OR`/`NOR`; operators at the same precedence associate left to right.
- References retain their IDs when variables are renamed. Use `{Collection::variable/name}` when
  names are ambiguous. Dependencies follow the receiving layer's modes in each collection.
- Formulas use stored units, including pixels for lengths; literal numbers use the selected display
  unit. Unit conversion functions and numeric comparisons are not supported.
- Number values also accept CSS expressions such as `clamp(1rem, 4vw, 2rem)` in the same field.
  These affect CSS export and keep the current canvas value as their fallback, shown below the input.
  Replacing CSS with a literal, reference or formula clears the CSS override in the same undo step.

Formulas update bound layout and visibility, support undo, and remain editable after `.fig` saves,
clipboard transfer, and collaboration. Missing dependencies or invalid results stay unresolved;
the last valid canvas property is retained. Formula authoring currently supports numbers and
Booleans; CSS and DTCG export report formulas as unsupported instead of silently flattening them.

## Tips

Use the diamond beside **Appearance → Visibility** to assign a Boolean variable to frames,
text, component instances, or nested layers. The picker previews `true` (visible) and `false`
(hidden); mixed selections can share one binding. While bound, the toggle displays the resolved
value and is read-only. Choose **Detach variable** in the picker to restore manual control.

The same diamond appears beside exposed visibility controls in an instance's **Component properties**,
including properties forwarded from nested instances. Assigning a variable there controls all layers
linked to that property in the selected instances, leaving the main component unchanged.

In the main component, expand a Boolean property and use the diamond beside **Default value**.
You can use a literal toggle value or a Boolean variable, including for a property exposed from a
nested component. Exposing a layer whose visibility already uses a variable preserves that variable
as the property's default. Instances resolve inherited defaults in their own variable modes.

In an instance's Component properties, **Detach variable** keeps the current value as a local literal
override. The reset arrow (**Use shared default**) removes the override and resumes inheritance.
Changing the default does not replace an instance's explicit literal or variable choice.

Replacing an exposed component-property link from Appearance requires confirmation. A variable
assigned to an individual instance layer overrides its property there; detaching that layer binding
restores the exposed property's control.

Numeric property fields show both the bound variable's name and its current value. Use the variable
picker beside **Appearance → Corner smoothing** to bind smoothing, including across a selection.
Smoothing variables store a fraction from 0 to 1: `0.6` displays as **60%**. Creating a variable from
the percentage field converts the displayed value automatically. Smoothing does not increase when
the object is scaled.

- Use collections to group related tokens (e.g., "Primitives" for raw colors, "Semantic" for role-based aliases, "Spacing" for layout values).
- Modes are useful for theme switching — define Light and Dark mode values in the same collection.
- Variables support aliases — a "Semantic" collection can reference values from a "Primitives" collection.
- See [Drawing Shapes](./drawing-shapes) for how fills and the color picker work.
