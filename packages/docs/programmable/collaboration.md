---
title: Collaboration
description: Real-time collaborative editing through WebRTC rooms, with no account required.
---

# Collaboration

Edit designs together in real time. Peers connect through WebRTC, with relay fallback when a direct connection is unavailable. No account is required.

## Sharing a Room

1. Click the share button in the top-right corner
2. Click **Share this file** — the link (`app.openpencil.dev/share/<room-id>`) is copied
3. Send it to your collaborators

Only Share puts a document into a room: the tab you share from becomes the room's tab and stays tied to its file. Anyone with the link can join.

## Joining a Room

Open the link, or paste it (or just the room ID) into **Join** in the share panel or **Join room…** on Home. The room opens in a tab of its own, so the documents you already have open are never changed. On a computer, a browser also offers **Open in desktop app**, which opens the room in OpenPencil through an `openpencil://join` link.

You join right away under a generated name such as *Teal Fox*; set your own in the share panel or in Settings, and it is used in every room.

Rooms are not stored on a server: the file lives on the devices of the people who have been in the room, so a room tab opens its document only while one of them is online. Until then it says it is waiting, explains why, and opens the file as soon as someone who has it joins. A room you have been in before opens from this device's copy right away and syncs your changes when others return.

**Leave room** in the share panel ends your part in the room. A tab that shared its document goes back to being that document; a tab that joined keeps the room's file as a local unsaved copy you can save. Each room tab keeps its own connection, so you can be in several rooms at once.

## What Syncs

- **Document changes** — every edit (shapes, text, properties, layout) syncs instantly
- **Variables and collections** — definitions, aliases, per-mode values, active/default modes, scope and token metadata travel with the document. Existing bindings keep their IDs, and shared spacing or sizing changes refresh bound layouts. Both participants need a version that supports variable synchronization.
- **Cursors** — see where each collaborator is pointing, with their name and color
- **Selections** — highlighted selections are visible to everyone
- **Agents** — the built-in AI chat and ACP CLI agents appear as cursors at the layers their canvas tools identify, its outlined label showing a sparkle and a callsign such as *Fern*. The cursor and outline have the color of the person running it, so you can tell whose agent it is. Only its name, kind, model, status, page, position, and edited layers are shared, never prompts or replies.

## Follow Mode

Click a collaborator's avatar in the top bar to follow their viewport. Your canvas pans and zooms to match their view, and a frame in their color with a “Following …” bar shows whom you follow. Click the avatar again, press <kbd>Esc</kbd>, or click, scroll, zoom, or switch pages yourself to stop.

An avatar counts the agents that person runs. Hover over it to see each agent, what it is doing, and on which page, and click **Follow** next to an agent to keep the page and layers it is editing in view; following continues between its replies and stops when it leaves. The button after the avatars lists everyone in the room with their agents, and works from the keyboard. Your own avatar lists your agents — click one to rename it — and has **Leave room**.

The share panel lists everyone in the room with the agents they run, what each agent is doing, and on which page. Follow an agent the same way to keep the page and layers it is editing in view; following continues between its replies and stops when it leaves. Double-click one of your own agents to rename it.

## How It Works

WebRTC attempts a direct peer connection and can use a TURN relay when the network requires it. Yjs merges document updates between participants. Variable names and values in different modes merge independently; simultaneous edits to the same value resolve to one value.

Room state, including variable definitions and collections, is cached locally for reconnecting. This does not create a permanently hosted document: keep saving your work to a local file or configured remote storage.
Moving and reordering layers merges too. Each layer remembers every parent it has been moved into and its position among its siblings, and every peer works out the same layer tree from that history ([Evan Wallace's tree CRDT](https://madebyevan.com/algos/crdt-mutable-tree-hierarchy/)). Moves, reorders, and new layers from different people all apply; if two people move the same layer at once, one move wins on every peer. When moves made at the same time would put two layers inside each other, the later move is undone, and a layer whose new parent was deleted meanwhile returns to where it was.

Everyone in a room needs a version of OpenPencil that records the layer tree the same way; versions that record it differently do not see each other's rooms.

The room persists locally — if you refresh the page, you rejoin it automatically with the same state.

## Tips

- Works in the browser and the desktop app
- Room IDs are cryptographically random — only people with the link can join
- Stale cursors are cleaned up automatically when someone disconnects
