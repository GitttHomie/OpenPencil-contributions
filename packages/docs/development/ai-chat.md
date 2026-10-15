# AI chat replies

How the built-in AI chat turns a message into edits, how a reply ends, and how what happens to its edits afterwards reaches the transcript and the model. ACP and Pi chats share the transcript, the saved conversation, and the marks on a reply, but run their own tool loop and agent presence.

## A message goes out

`src/app/ai/chat/submission/use.ts` sends a message through the AI SDK's `Chat`. Before sending, it appends notes for the model to the text: the layers you referenced, and the edits you undid or redid since the model last heard (`context.ts`). The transcript shows only what you wrote; `stripModelNotes` removes the notes. Notes go on the newest message only. Earlier messages never change, so the provider can keep caching the conversation up to the new message.

`history/continuation.ts` (`requestMessages`) leaves tool calls without a result out of the request. They stay in the saved transcript.

## A run

Optional automatic checks wrap the shared transport in `design-checks/transport.ts`. A check uses changed roots and measured layout, adds screenshots when supported, and continues inside the same visible reply with at most two correction passes followed by a read-only report. Follow-ups retain the original run's page, undo entries, and remaining step budget; interrupted or failed replies never trigger another request. `design-checks/state.ts` tracks inspection status separately from completion and invalidates it after later edits.

`transports.ts` starts a run (`tools/run.ts`) when the message is sent, before the model is reached, so a Stop at any point ends a run that exists. A `Run` belongs to one reply and holds:

- the page it works on, which your navigation does not move and the agent's `switch_page` does;
- the step budget captured when the message started;
- each page as it was before the run first edited it, for `diff_changes`;
- every undo entry its calls pushed, with the tool and call that pushed it;
- the calls that changed the document, and the undone calls it already told the model about.

The chat's agent is one presence entry per document (`presence/registry.ts`). It shows as thinking when the run starts and points at the layers each call changed, on whichever page they are. With Follow agents on, following starts with the run and ends when the agent rests and none of your other agents is at work. An agent you chose to follow keeps you with it while it rests.

## A tool call

`tools/index.ts` runs every call through `executeCall`:

- Calls that change the document take a lock in turn, since whole-page snapshots must not interleave. A call that gets the lock after the reply ended changes nothing and returns an error.
- The document change is captured, pushed as one undo step labelled `aiUndoLabel(tool)`, and recorded on the call's own run, the one it started in, even if a later reply has begun.
- The change is recorded for the chat's change review, and the agent points at it.
- A call's result reaches the model as JSON. `eval` converts what a script returns, as MCP and the CLI print it.
- If you undid or redid the run's own edits since the model last heard, the result carries an `undoNote` saying so.

## Tool approvals

Kiro's “Always allow” choices for verified OpenPencil canvas tools are stored locally per adapter and exact tool name. New sessions must identify each call as that same OpenPencil tool before an approval is reused; titles alone, other MCP servers, shell tools, and non-design sessions do not inherit it. “Allow once” authorizes only that call; the canvas group approval lasts for that session. Settings → Tool access → Reset approvals clears the app's remembered choices; a running CLI may retain its own trust until its session closes.

Codex and Claude sessions scope configured MCP servers to OpenPencil's canvas connection and the external connections selected for that conversation. Codex gives supplied connections unique session names to prevent global commands, environments, or headers from merging into them; the prompt receives the routing map and tool events retain their logical names in the app. Its native launcher reads the effective catalog with `codex mcp list --json` and disables inherited servers through process-only configuration. Claude receives `strictMcpConfig` in its ACP session metadata. Verification, catalog, review, and vision sessions receive an empty selection. Global CLI settings and credentials are not rewritten; Kiro and Gemini retain their adapter's existing inheritance behavior.

## A reply ends

A run ends once, in one of three ways: finished (`onFinish`), failed (`handleError`), or stopped (the request's abort signal). The agent goes idle and its cursor leaves the canvas. A tool already running keeps going: its edit lands in its run, but cannot move the agent again.

When the chat's own `onFinish` reports a reply that was stopped, failed, or cut off, `settleEndedReply` waits for the run's last edit, then settles the message (`settle.ts`):

- reasoning and text are marked done;
- each call that never reported back fails with whether it changed the document, which the model reads next time;
- a stopped reply is marked stopped.

Diagnostics record `chat.completed`, `chat.stopped`, or `chat.failed`.

Content-bearing session logs are separate from technical diagnostics. `chat/logging/` captures the app-visible transport request, exposed reasoning and response chunks, tool inputs and results, permission decisions, and completion timings. ACP adds its actual composed prompt and permission outcomes; API models add reported usage. These are not a transcript of hidden model reasoning or CLI operations the protocol does not expose.

Settings → Diagnostics controls logging, export, and deletion. The last 20 runs are retained locally, bounded to 2 MiB of text and 8 MiB of image attachments per run. The desktop mirrors runs under its application log directory in `ai-sessions/<run-id>/session.jsonl`; browser storage uses IndexedDB. Export produces a ZIP of JSONL files and original image bytes. Nothing is uploaded automatically. Known credentials and transport environment/header objects are redacted, but logs intentionally contain design content and user prompts.

Streaming deltas coalesce before capture; writes checkpoint every two seconds and at completion. Slow persistence coalesces pending snapshots rather than queueing every token. A crash can leave the latest checkpoint marked running, and logging limits are explicit in the text or image reference. Disabling logging stops active captures; clearing removes stored runs without deleting chat history.

Canvas requests also carry metadata traces through the authenticated MCP connection. The helper assigns one request ID and reports receipt, dispatch, app progress, completion, timeout, disconnection, and late replies. The app records receipt, page preparation, queueing, execution, and response delivery. Technical diagnostics retain these events; managed CLI chats also attach them to the originating run as `mcp.request` events. A late reply keeps its original run association. Trace records contain identifiers and timing, not tool arguments, responses, or credentials.

The helper retains at most 256 trace events for replay after a connection returns; the app deduplicates replayed events. Tracing follows the existing technical-diagnostics and session-logging switches and is disabled when both are off. Only the authenticated current app can change tracing or acknowledge request progress. Timeouts include the request ID and last acknowledged app stage; a timeout does not cancel execution or automatically retry a mutation.

`mcp.runtime` events record document/page navigation, visibility, focus, connection changes, and scheduling gaps while logging is enabled. Gaps include elapsed wall time and monotonic time, which can help distinguish a blocked event loop from sleep or a clock adjustment; they do not establish a cause on their own. Document metadata describes the active editor when the event was recorded, while managed requests retain their session's existing document targeting.

`chat/media.ts` projects images for both chat presentation and logging without modifying model-facing tool payloads. Chat previews and downloads retain the original bytes instead of re-encoding a rendered thumbnail.

`submission/undone.ts` records the reply's turn (`turns.ts`) once the run settles, so an edit landing after Stop belongs to the reply.

## Undo and the model

A turn keeps the reply's calls and their undo entries. On every undo history change, each turn works out which of its calls are undone with `UndoManager.stateOf`: an entry on the redo stack is undone, one on the undo stack applied. An entry that left the history keeps its last state; undone and then cleared from Redo by a new edit, it stays undone. Changes are written to the reply's metadata, and the transcript reads only the metadata.

Edit → Undo and the chat's **Revert changes** therefore end in the same state: Revert undoes the reply's edits still applied, when they are the newest on the undo stack, and **Restore changes** redoes its undone edits, when Redo would bring exactly those back next.

`undoToReport` compares each reply's undone calls with what the model was last told, and the next message carries the difference as a note. The report records the message that carried it. If that message is sent again, for example when you edit it, the report is made again.

## Saved conversations

A document owns its pending submissions, live chat transport, history controller, and selected MCP connections
(`chat/documents.ts`). Opening or switching tabs changes the chat panel's view without stopping
the original document's run. Returning to that tab shows its ongoing or completed reply.
Closing the document stops its agent, saves the interrupted conversation, and releases its
transport and subscriptions. A new chat or a different saved conversation still ends the
previous run in that document. Async reply completion records edits against the originating
editor, even when another tab is visible.

A reply's metadata (`chat/metadata.ts`) keeps whether you stopped it, and its edits with those undone and what the model was last told. Conversations save messages with `structuredClone`, so metadata is written from the plain message, never from the chat's reactive copy. Reopening a conversation settles any reply saved mid-way. The undo history does not survive closing a document, so a reopened reply keeps its marks but offers no Revert or Restore.

## Traces

Save trace… in the conversation menu writes a file to reproduce what the agent did (`chat/trace/export.ts`). It holds the conversation's messages, its runs, and its diagnostic events.

A run is one message sent and every step the model took to answer it (`chat/trace/recorder.ts`). It records the model and settings, the last message sent, and per step the response's finish reason, usage, warnings, and duration; a failed run keeps the error, and the step that failed is the one after the last recorded. Instructions and the tools offered are stored once under their fingerprints and shared by every run that used them.

A step's request is not stored. It is the conversation through the run's last message, as `requestMessages` prepared it, plus the reply's earlier steps; `chat/trace/rebuild.ts` rebuilds it and compares its fingerprint with the one recorded when the step ran, so a rebuild that no longer matches what was sent is reported instead of replayed. Runs live in the chat database beside their conversation and are deleted with it.
