---
title: Components
description: Creating reusable components, instances, component sets, overrides, and live sync in OpenPencil.
---

# Components

Components are reusable design elements. Edit the main component and all its instances update automatically.

## Browse Components

Open the **Assets** tab in the left panel to browse local components and enabled libraries. Use grid or list view, search by component name, and select a component to see its details. You can insert an asset by clicking it, pressing <kbd>Enter</kbd>, or dragging it onto the canvas.

Local assets are grouped by source page. Published library assets remain available when their revision has been downloaded, including when the remote provider is temporarily offline.

## Creating a Component

Select a frame or group and press <kbd>⌥</kbd><kbd>⌘</kbd><kbd>K</kbd> (<kbd>Ctrl</kbd> + <kbd>Alt</kbd> + <kbd>K</kbd>). The selection becomes a reusable component.

Any other layer, or several layers, is wrapped in a new white component at their bounding box, in the topmost layer's place in the layer list; a single wrapped layer gives the component its name.

Components display a purple label with a filled diamond icon above them. Instances use an outlined diamond, both on the canvas and in the Layers panel.

Copying and pasting a main component creates a linked instance. If the destination would nest a component inside its own definition, directly or through another component, the instance is pasted into the nearest safe ancestor instead. Pasting into another document imports the definition as a dependency.

Double-click a component or instance label on the canvas to rename it. Press <kbd>Enter</kbd> to commit or <kbd>Escape</kbd> to cancel.

## Component Sets and Variants

Select a single component and click **Add variant** to wrap it in a component set and add a duplicate. Existing instances keep their original component link. You can also select two or more components and press <kbd>⇧</kbd><kbd>⌘</kbd><kbd>K</kbd> (<kbd>Shift</kbd> + <kbd>Ctrl</kbd> + <kbd>K</kbd>) to combine them.

New canvas-created sets use Hug auto-layout, 20 px spacing and padding, and a dashed purple border. You can change or disable their layout. Only the set's name appears on the canvas; click or drag that name to select or move the whole set, right-click for its menu, or double-click to rename it. Individual variant names remain in Layers. Sets made by scripts with `figma.combineAsVariants()` keep the Figma-compatible exact wrapping behavior.

Each component in a set can define values across multiple variant dimensions, such as `Size=Small`, `State=Hover`, and `Theme=Dark`. OpenPencil supports sparse combinations, so a set does not need every possible combination. The top-left variant is the default and is used as the fallback when an update no longer contains an exact combination.

Select the set to manage **Variants** as collapsible property cards, such as **State: Base / Hover** or **Size: Small / Large**. Create, rename, reorder, or delete properties. Expand a card to create, rename, reorder, or delete its values. Drag a grip to reorder, or focus it and press Up or Down. Available values persist even before any component uses them; adding one does not create a component.

Select a component inside the set to assign one value from each property's dropdown. On an instance, those choices instead switch to the matching component; combinations that have no component are unavailable. Creating a duplicate combination through a dropdown is rejected. Existing conflicts, including those caused by removing a property, show warnings in the set panel and on each affected component, with clickable links to the conflicting components.

Deleting an in-use value requires a replacement and is rejected if the reassignment would create a duplicate combination. Deleting a property removes its descriptors, not the components; removing the last property preserves their names. Actual component variants can be selected, reordered, or deleted on the canvas or in Layers. Property and value edits support Undo/Redo and save/reopen.

## Component Properties

Components and component sets support reusable text, boolean visibility, instance-swap, and slot properties. Link a property to a descendant field, then select an instance to edit its assigned value without detaching it. Properties and assignments are preserved when saving and reopening `.fig` files.

Manage shared and variant-specific attributes from the component set. An attribute applies to the variants with objects bound to it. Corresponding objects at the same named structural path are grouped into a collapsed binding row; expand it to see the source variant and select or unlink one object. Same-named sibling objects remain separate.

Under **Variant defaults**, give individual variants a different default or reset them to the shared default. Instance overrides take precedence and survive switching away and back. Instances show only the attributes used by their current variant. Variant defaults persist when saving and reopening `.fig` files.

## Slots

A slot is a frame of a main component whose content each instance can change. Select a frame inside a main component and choose **Create slot** from the context menu or the Slots section, or select other layers to wrap them in a new slot frame. Slot settings set a description, the components it prefers, and how many items it holds; an instance outside those limits shows a warning. In an instance, add, reorder, and remove a slot's items, or reset it to the component's content.

## Behaviours and Preview

A behaviour makes a main component or component set work like a real control, after [Reka UI](https://reka-ui.com)'s primitives: Button, Text field, Textarea, Number field, Toggle, Switch, Checkbox, Radio, Radio group, Toggle group, Slider, Progress, Tabs, Collapsible, or Accordion. Select the component and use **+** in the **Behaviour** section to choose one.

The section lists what the control needs:

- **Values** — the property that holds each value: a variant or boolean property for On, Checked, Pressed, Open, Filled, or Disabled (with the variant values that mean on and off), a text property for a field's text, or a slider's own minimum, maximum, step, and default.
- **Parts** — the slot that draws each part, such as a switch's thumb, a slider's track, range, and thumb, or a tab list. A group's items slot holds instances of its radios, toggles, or collapsibles.
- **States** — a variant property whose values draw default, hover, pressed, focus, and disabled. Values named like those states are matched automatically.

Rows the control requires come first; the rest are under **More options**. When a component has nothing to bind yet, a row offers to create it: a text layer and text property, Off and On variants, or a slot. The chip next to the control's name says what is missing, and clicking it goes there.

Press <kbd>⌥</kbd><kbd>⌘</kbd><kbd>↩</kbd> (<kbd>Ctrl</kbd> + <kbd>Alt</kbd> + <kbd>Enter</kbd>), choose **View → Preview**, or use ▶ next to Share to preview the canvas. Each top-level layer holding controls runs as live Reka UI components over the canvas, drawn by the component's variants: switches flip, sliders drag, tabs and accordions open, and text fields are real inputs with the browser's caret, selection, and paste. Preview never changes the document or its history. **Reset** puts every control back as designed, and <kbd>Esc</kbd> or the pill's close button returns to editing. In split view, each canvas previews on its own.

Behaviours are saved in `.fig` files and published with library components.

## Component Libraries

A component library publishes reusable components as an immutable revision. Each published asset has stable library, asset, and revision identity, so different instances can remain on different revisions until you explicitly update them.

### Publish a Library

1. Create the components and component sets you want to share.
2. Open **Assets**, then select **Manage libraries**.
3. Select **Publish library**.
4. Enter a stable library ID and display name. The library ID is locked after the first publication.
5. Optionally search the change list and enter a revision description.
6. Select the added, modified, renamed, or removed assets to include.
7. Confirm the destination and select **Publish library**.

On later publications, unchecked changes remain pending. Unchanged assets keep their previous published definitions, and removed definitions remain available while documents still reference their historical revision.

### Enable and Insert Library Assets

Open **Assets → Manage libraries** to enable a published library. Its components appear in the Assets panel alongside local components. Insert one by clicking it, using the keyboard, or dragging it onto the canvas.

Published definitions are read-only in consuming documents. Edit the source document and publish another revision to change a definition. Instances linked to those definitions remain editable through their component properties and overrides.

### Review and Accept Updates

Open **Manage libraries → Updates** to discover newer revisions. Discovery does not modify the document. You can review the current and updated instance side by side, navigate between affected instances, and then update:

- The selected instance
- All instances of one asset
- Instances on the current page
- Instances across all pages

OpenPencil preserves compatible text, visibility, and instance-swap assignments. If an exact variant no longer exists, the review identifies the top-left fallback before you accept it. Applying an update creates an undo entry.

### Local, Storage, and Offline Use

Libraries can use the local browser catalog or a configured storage provider. Remote publication uses immutable revision objects and a conditional latest pointer, preventing two publishers from silently overwriting each other.

Downloaded revisions are cached locally. A document can continue rendering and inserting downloaded definitions while offline. Integrity failures are reported instead of being hidden by cached data.

### Saving Consumer Documents

Enabled-library bindings and materialized definitions are saved with `.fig` documents. Reopening a consumer file preserves its linked instances and revision identities, even when its remote library is unavailable.

## Exposing Component Properties

Select a child layer inside a main component. The **Expose as component property** section lists its available attributes, with Visibility first, their type icons, and current values. Before linking, the visibility switch and text input edit the object’s own values. The visibility switch sits beside the link action; text has a label row followed by its input and link action. Once linked, the value control is disabled and displays the property’s default. Edit that default from the component properties panel. The linked property name and link icon are blue.

Click **Expose** beside an attribute to **Create property…** or choose an existing compatible property. Text attributes can share text properties, visibility attributes can share boolean properties, and nested instances can share swap properties. Creating a property starts with the layer’s current value as its default. The creation row has a **Property name** label, name input, green confirm button, and red cancel button. Linking an existing property applies its default to the source layer while preserving existing instance assignments.

Once linked, the button shows the property name. Open it to select another compatible property, create another property, or **Unbind** this attribute. Unbinding preserves the definition and its instance assignments so it can be reused.

Select the main component to manage **Component properties**. Use **Create property…** to create an unbound String, Boolean, or Instance swap property with a name and initial default, then link it from a child layer. Each definition starts with its type icon and visible type label (String, Boolean, or Instance swap), name input, and Delete button on one row. Use the chevron to collapse the default and connected objects while keeping this header visible. Cards remember their expanded state when switching selections during the session; new properties start expanded. Separators divide the header, default value, and connected objects. The value appears below: a **Default value** label with a switch for booleans or an input for strings. Connected objects follow as node icon, object name, and Unbind icon. The node icon identifies the object type. Click its name to select it or its unlink icon to disconnect it. Unused definitions show **No connected objects** and remain available in the link menu. Delete removes the definition and its connections without deleting the objects. These actions support Undo/Redo.

Changing a default updates connected source layers and instances that inherit their values; explicit instance assignments remain unchanged. In a component set, new definitions belong to the set and can be shared by compatible layers across variants.

Drag a property card's grip to change attribute order, or focus the grip and press Up or Down. The saved order also applies to instance controls. Properties reorder within their owning component or set; a variant's local property stays with that variant.

Select an instance to edit exposed text, visibility, or nested-instance swaps. Exposed text edits resize Hug instances and reflow their layout parents while you type, including through Undo/Redo; fixed text boxes keep their sizing mode. Authoring is unavailable inside instance descendants and in read-only library definitions.

## Creating Instances

Right-click a component and select **Create instance** from the context menu. The instance appears 40 px to the right of the source component, visually identical.

Instance creation is available only through the context menu — there's no toolbar button.

## Detaching an Instance

Select an instance and press <kbd>⌥</kbd><kbd>⌘</kbd><kbd>B</kbd> (<kbd>Ctrl</kbd> + <kbd>Alt</kbd> + <kbd>B</kbd>) to detach it. The instance becomes a regular frame with no link to the original component. All overrides are baked in.

## Go to Main Component

Right-click an instance and select **Go to main component**. The editor navigates to and selects the main component, switching pages if needed.

## Live Sync

When you edit a component, all its instances update automatically. Synced properties include:

- Width and height
- Fills, strokes, and effects
- Opacity and corner radii
- Layout properties (auto layout settings)
- Clips content setting

Sync triggers automatically after node updates, moves, and resizes within a component.

## Overrides

Instances can override specific properties without breaking the sync link. When a property is overridden on an instance, that property is skipped during sync — other properties continue to update from the main component.

### Overridable Properties

Child-level overrides support: name, text, font size, font weight, font family, plus all visual and layout properties (fills, strokes, effects, opacity, corner radii, size).

### New Children

When you add a child to a component, all existing instances gain a cloned copy automatically. Child order in instances always matches the component.

## Hit Testing

Components and instances are opaque containers — clicking on a child selects the component itself, not the child. **Double-click** to enter the component and select children inside it.

## Visual Treatment

| Element              | Appearance                               |
| -------------------- | ---------------------------------------- |
| Component label      | Purple with diamond icon, always visible |
| Instance label       | Purple with diamond icon, always visible |
| Component set border | Dashed purple outline                    |

## Keyboard Shortcuts

| Action               | Mac                                  | Windows / Linux                                   |
| -------------------- | ------------------------------------ | ------------------------------------------------- |
| Create component     | <kbd>⌥</kbd><kbd>⌘</kbd><kbd>K</kbd> | <kbd>Ctrl</kbd> + <kbd>Alt</kbd> + <kbd>K</kbd>   |
| Create component set | <kbd>⇧</kbd><kbd>⌘</kbd><kbd>K</kbd> | <kbd>Shift</kbd> + <kbd>Ctrl</kbd> + <kbd>K</kbd> |
| Detach instance | <kbd>⌥</kbd><kbd>⌘</kbd><kbd>B</kbd> | <kbd>Ctrl</kbd> + <kbd>Alt</kbd> + <kbd>B</kbd> |
| Preview | <kbd>⌥</kbd><kbd>⌘</kbd><kbd>↩</kbd> | <kbd>Ctrl</kbd> + <kbd>Alt</kbd> + <kbd>Enter</kbd> |

## Tips

- Editing text inside an instance creates an override — the text won't be overwritten when the component changes.
- Use component sets to organize multidimensional variants such as size, state, and theme.
- Publish reusable assets from their source document; published definitions are intentionally read-only in consumer documents.
- Review updates before accepting them when a revision removes an exact variant combination.
- See [Context Menu](./context-menu) for all component-related actions.
