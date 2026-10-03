---
title: AI Chat
description: Built-in AI assistant with 90+ tools for creating and modifying designs.
---

# AI Chat

Press <kbd>⌘</kbd><kbd>J</kbd> (<kbd>Ctrl</kbd> + <kbd>J</kbd>) to open the AI assistant. Describe what you want — it creates shapes, sets styles, manages layout, works with components, and analyzes your design.

## Design guidance

Describe what you want in your own words. Briefs, PRDs, questionnaires, and approval of intermediate design stages are optional. The assistant uses your request and existing document, makes reasonable assumptions, and scales its work to the task.

Built-in guidance covers visual direction, UX flows and states, editable design systems, and review. For substantial new work, it encourages the assistant to reuse or establish variables and components before composing screens from linked instances. Small edits can proceed directly.

Layout surfaces and photo containers use frames or components. Full-card photos are image fills on the card itself; scrims are additional fills above that image, with text and controls kept as children. Separate photo placeholders use a frame and can contain an icon. Shapes remain available for graphics and illustrations. The `stock_photo` tool accepts frames, components, and instances, preserves children and overlay fills, and replaces an existing image without adding duplicate fills.

The AI can append solid or gradient fills with `set_fill` using `operation: "append"` and revise one fill using `fill_index`. For example, a top-to-bottom scrim uses `color: "#00000000"`, `color_end: "#000000CC"`, and `gradient: "top-bottom"`. The returned stack confirms which fills actually exist. `set_image_fill` preserves these overlays when replacing a photo. The shared authoring reference includes an executable card-and-scrim example, and review guidance calls for checking both the fill stack and rendered contrast.

Corner treatment is also a design choice. Agents can combine a nonzero radius with `cornerSmoothing` in JSX, or use `set_radius` with `corner_smoothing` on existing nodes. Smoothing ranges from 0 to 1; 0 keeps circular corners. Guidance asks agents to match the product's visual direction and keep reusable components consistent, without imposing smooth corners on every design.

Direct chat, desktop CLI agents, and harness sessions share the workflow. The `get_design_guidance` tool supplies detailed topics on demand and is also available to external MCP clients. Direct chat enables variable discovery, creation, editing, and binding tools by default; explicit tool restrictions in Settings still apply.

Render results give the agent specific feedback about repeated unbound spacing, potentially duplicated component definitions, and overlapping top-level content. These checks do not impose a palette, spacing scale, or component count. If rendering fails partway through, the partial nodes are removed before a corrected retry.

The assistant checks document structure and rendered output where supported. Canvas review can identify design problems, but cannot verify runtime keyboard behavior, screen-reader support, or actual usability.

## Setup

1. Open the AI chat panel (<kbd>⌘</kbd><kbd>J</kbd>)
2. Click the settings icon
3. Add a model and configure its provider, model ID, credentials, and capabilities
4. Save the model and assign it to **Design agent**

You can configure multiple reusable models and separately assign models for design work, reviews, and image input. Models using the same provider connection reuse its stored credential. Fast tasks is hidden until it has a supported workflow.

Choose **Review design** in chat to review the selection, or the current page when nothing is selected, with the assigned **Review** model. An optional focus can narrow the request. Reviews return findings in a separate dialog without applying changes or replacing the Design model. API models and local CLI profiles can be reviewers; Pi profiles are not supported for Review. A screenshot is included when supported; otherwise the result is marked as a structural review. The snapshot is bounded to 300 nodes, so select a smaller region for detailed reviews of large documents.

API review requests receive no tools. CLI reviews launch a separate session without OpenPencil or external MCP server connections supplied by the app and deny ACP permission requests. The CLI's own configuration still belongs to that CLI. Closing the dialog or cancelling stops the review; switching documents, pages, or reviewer discards pending results.

The chat composer grows with multiline prompts and can pin the current canvas selection as explicit node context. Assistant messages show provider reasoning in collapsible sections and provide a per-response copy action. Image attachments remain available for visual references when a Vision model is configured. Streaming responses use a hardened Markdown renderer with Shiki-highlighted code blocks; unsafe link protocols and embedded data images are blocked.

## Local CLI agents

Choose **Add model** in **Settings → AI & agents**, then select **Claude Code**, **Codex**, **Kiro CLI**, or **Gemini CLI** as the provider. The desktop app detects installation status and shows setup actions inside that model's editor. Sign in through the CLI first; OpenPencil uses its existing authentication without requesting another API key.

Once the adapter is available, **Model ID** lists the models advertised by that CLI account. Save separate profiles for different models from the same CLI, then assign them independently to Design and Review or switch profiles in chat. OpenPencil applies the saved choice to each new session before sending a prompt, without changing the CLI's global default. If a saved model is unavailable, the request stops instead of falling back to another model.

**CLI default** deliberately follows the adapter's current default, preserving existing profiles that have no model selected. **Refresh models** reloads the account's list through a temporary session with no prompts or app-supplied MCP connections. Adapters that do not expose model selection can still use CLI default; update the adapter to expose explicit choices when supported. Both ACP configuration selectors and the older session model API are supported.

- **Installed**: save the profile, then assign it to Design or Review. The chat picker lists saved Design-capable profiles.
- **CLI detected · chat adapter required**: choose **Install adapter**. This explicitly runs `npm install --global @agentclientprotocol/claude-agent-acp` for Claude Code or `npm install --global @agentclientprotocol/codex-acp` for Codex. Install Node.js and npm first if the action is disabled.
- **Not installed**: follow the setup guide, then click **Refresh**.

Discovery does not install software automatically. A failed adapter installation can be retried after correcting npm permissions or network connectivity. Selecting a provider does not save a profile or switch your active chat; cancelling the model editor leaves your profiles unchanged.

Canvas editing through local agents also needs the OpenPencil MCP companion. If it is missing, choose **Set up canvas connection** inside the CLI model editor. This installs the companion version matching the app and reconnects the editor without requiring an app restart. Both companion and adapter setup use the public npm registry, even when your default registry is private. If startup fails after installation, retry or inspect **Settings → MCP**.

Kiro CLI connects through its native ACP v3 mode (`kiro-cli acp --agent-engine=v3 --auth-method=cli`); use a CLI version that supports these options. Gemini CLI connects through `gemini --acp`. Neither needs a separate chat adapter.

Kiro chat waits for the OpenPencil canvas connection before sending its first prompt. Its permission dialog offers **Allow OpenPencil canvas tools for this chat** for verified canvas tool requests. This explicitly approves canvas inspection and edits for that agent session; shell commands, file operations, other MCP servers, and unidentified tools still require separate approval. Restarting the agent session resets this choice, while the CLI's own **Always allow** choices remain managed by the CLI.

Kiro may also run its own extension and tool-discovery operations. **Kiro extensions** refers to Kiro Powers, its skills and integration system. A **Done** status belongs to that individual tool call, not to the overall design task.

The status below the chat input tracks the entire run. **Agent is working…** remains visible during reasoning and tool calls; **Waiting for your approval** identifies a pending agent permission request. **Run finished** appears only after the provider confirms completion and stays visible until the next run. Stopping, failure, interruption, and reaching a limit have separate statuses, so a disconnected stream cannot look successfully finished. This confirms that the agent stopped working, not that the design has passed review.

In local-agent chat, “build an app” means create editable screens in the open canvas. OpenPencil includes this context on every turn; application source files are only requested when you explicitly ask for implementation outside the canvas. If canvas tools fail, the agent should report the failure rather than fall back to scaffolding a code project.

Local CLI discovery is available only in the desktop app. Browser users can configure the direct model providers described above.

## Step limit

In **Settings → AI & agents → Chat**, set **Maximum steps per message** to a whole number from 1 to 1,000. The default is 50. Press Enter or leave the field to save a valid value; invalid drafts do not replace the saved preference. Higher limits allow longer tool-driven tasks but can increase latency and provider cost.

The built-in AI captures this limit when each message starts. Stopping, remaining-step warnings, and the **Continue** action use that same budget. Changing it does not interrupt an ongoing request; the next message or continuation uses the new limit. A step is one model iteration and can include multiple tool calls. ACP and Pi agents manage their own limits.

## Tool access

Open **Settings → Tool access** to choose which tools direct AI model connections can use. All shared canvas tools are enabled by default, matching the local MCP canvas catalog. Existing explicit overrides are preserved. Search by name or description, expand read-only or side-effect groups, and toggle individual tools or an entire group. Group switches affect all tools in that group, not only search results. **Restore defaults** enables the full available canvas catalog. MCP-specific filesystem, document-connection, and external integration tools still depend on their transport.

Preferences are saved locally and apply to the next message, including in an existing conversation. They do not change an already-running request. Enabling many tools increases the schemas sent to the model.

The **Local MCP** segment has independent settings for clients connected to OpenPencil's MCP server, including ACP and Pi agents. Restart the server and reconnect stdio clients after changing those settings. Remote MCP connections, WebMCP access, and Pi's shell/filesystem permissions remain separate.

Tool toggles control which tools are offered, not which operations scripts may perform. An enabled `eval` or other script-capable tool can perform design operations whose dedicated tools are disabled; these switches are not a sandbox.

## Saved Conversations

Use **Conversation history** to return to a saved chat, start a **New chat**, or rename or delete a conversation. History and attachment previews are stored locally; **All chats** lets you browse transcripts from other documents.

A conversation belonging to another document is read-only until you open that document. A saved agent transcript is not a guarantee that its external agent session can resume: when resumption is unavailable, start a new chat. Local history is not cloud synchronization or a backup.

In the Chat settings beside the model overview, choose whether reasoning is **Collapsed by default**, **Expand while thinking**, or **Expanded by default**. Disclosure animations follow the app's reduced-motion preference. Expanding older reasoning does not force the conversation to scroll to the bottom.

## Supported Providers

| Provider                 | Models                                          | Setup                                                                                                       |
| ------------------------ | ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| **OpenRouter**           | Claude, GPT, Gemini, DeepSeek, Qwen, and others | API key from [openrouter.ai](https://openrouter.ai)                                                         |
| **Anthropic**            | Claude Sonnet 4.6, Claude Opus 4.6              | API key from [console.anthropic.com](https://console.anthropic.com)                                         |
| **OpenAI**               | GPT-5.3 Codex, GPT-4.1, o3, o4-mini             | API key from [platform.openai.com](https://platform.openai.com)                                             |
| **Google AI**            | Gemini 3.1 Pro, Gemini 3 Flash                  | API key from [aistudio.google.dev](https://aistudio.google.dev)                                             |
| **Z.ai**                 | GLM-5.1, GLM-5, GLM-4.7, GLM-4.5 family         | API key from [docs.z.ai](https://docs.z.ai/devpack/quick-start)                                             |
| **MiniMax**              | MiniMax M3, M2.7, M2.7-highspeed, M2.5, M2.1    | API key from [platform.minimax.io](https://platform.minimax.io/user-center/basic-information/interface-key) |
| **OpenAI-compatible**    | Any endpoint with OpenAI API format             | Custom base URL + key. Supports Completions and Responses API toggle.                                       |
| **Anthropic-compatible** | Any endpoint with Anthropic API format          | Custom base URL + key                                                                                       |

No backend, no subscription — your key talks directly to the provider. Browser requests are subject to each provider's CORS policy, and model deployments vary in how reliably they stream tool calls. See [BYOK provider and model compatibility](./byok-provider-compatibility) for measured results and reproduction steps.

## External MCP connections

Desktop ACP agents can also use trusted remote [Model Context Protocol](https://modelcontextprotocol.io/) servers. In **Settings → MCP**, under MCP connections, add a named Streamable HTTP endpoint, optionally save a bearer token, and enable the connection. OpenPencil stores the token in the configured credential backend rather than ordinary settings and resolves it only when starting the ACP session.

Remote servers must use HTTPS. Loopback HTTP endpoints are accepted for local development. Review and trust a server before enabling it: its tools may read external data or perform actions with the credentials you provide. OpenPencil's built-in design MCP server remains attached automatically and does not need to be added here.

## What It Can Do

The configurable tool catalog covers these categories; the tools offered to a model depend on your Tool access settings:

- **Create** — frames, shapes, text, components, pages. Renders JSX for complex layouts.
- **Style** — fills, strokes, effects, opacity, corner radius and smoothing, blend modes.
- **Layout** — auto-layout, grid, alignment, spacing, sizing.
- **Components** — create components, instances, component sets. Manage overrides.
- **Variables** — create/edit variables, collections, modes. Bind to fills.
- **Query** — find nodes, XPath selectors, read properties, list pages, fonts, selection.
- **Inspect** — `get_jsx` for JSX roundtrip view, `diff_jsx` for structural diffs, `describe` for semantic role and design issue detection.
- **Analyze** — color palette, typography audit, spacing consistency, cluster detection.
- **Export** — PNG, SVG, JSX with Tailwind classes. Vision-based verification via `export_image`.
- **Vector** — boolean operations, path manipulation.

## Visual Verification

The assistant can verify its work visually. When `export_image` is enabled, it can capture a screenshot after creating or modifying designs and checks the result against the original request. This catches layout issues, missing elements, and color mismatches that text-only responses would miss.

## Example Prompts

- "Create a card with a title, description, and a blue button"
- "Make all buttons on this page use the same border radius"
- "What fonts are used in this file?"
- "Change the background of the selected frame to a gradient from blue to purple"
- "Export the selected frame as SVG"
- "Find all text nodes with font size less than 12"
- "Describe the selected component — what role does it look like?"
- "Show me the JSX for this frame"

## Tips

- Select nodes before asking — the assistant knows what's selected.
- Be specific about colors, sizes, and positions for precise results.
- The assistant can modify multiple nodes in one message.
- You can browse other pages while a reply runs: the assistant keeps working on the page where the message started, and its previews show when you return. If the assistant switches pages itself, your view follows.
- Use "undo" in the editor if you don't like the result — AI mutations support full undo.
- All layout is recomputed automatically after each tool execution.
