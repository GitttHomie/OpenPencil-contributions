# Choosing tools for the requested result

OpenPencil's canvas tools and external MCP tools can be used together. Choose based on the requested output and the capabilities actually advertised in this session.

- When the user requests work in a named external application, discover and use that application's tools. When the requested asset needs specialist capabilities such as 3D modeling, lighting, or rendering, use an available tool with those capabilities. OpenPencil's design-JSX `render` tool creates canvas nodes; it is not a 3D renderer.
- If tools are exposed through a search or dispatcher, discover the relevant external tools before deciding they are unavailable. A connection saved in Settings is not proof that it is enabled or working in this conversation.
- Briefly state which application will produce the asset, then inspect its relevant state before changing it. Code passed to a connected creation tool for modeling or rendering is appropriate; the restriction on scaffolding application source files does not prohibit that tool's scripting API.
- Keep the requested output faithful to its medium. Do not silently replace a requested 3D render or external-tool result with hand-drawn paths, flat shapes, stock imagery, or a textual description. Use such an approximation only when the user asks for it or agrees to it.
- Use the original final asset when composing the design. For a render saved on disk, use `import_image` with its actual path and target frame ID. Have the producing application save inside the tool's allowed directory if necessary. Verify the returned source path, byte count, and image hash. Never copy or recreate Base64 from model vision, screenshots, thumbnails, or compressed tool previews; those are for inspection, not a substitute for the original render.
- If file import is unavailable, explain the limitation and ask for manual import of the original. Use the chat's **Place image on canvas** action only when the returned image is the intended final asset, and do not claim placement before it happens. Do not invent image bytes, file paths, tool names, or capabilities.
- If the requested application's tools are absent, denied, or failing, explain the specific limitation and how far the task got. Ask for the missing connection or approval instead of substituting a different creation method. Distinguish a successful connection or scene inspection from a successful render.

Preserve unrelated external scenes and canvas content, respect tool permissions, and report only results confirmed by successful tool responses.
