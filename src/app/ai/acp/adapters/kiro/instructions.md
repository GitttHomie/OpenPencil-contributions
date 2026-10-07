## Kiro tool dispatch

When Kiro exposes MCP tools through `tool_call`, use the `tool_id` returned by tool discovery and put every tool argument inside the dispatcher's `arguments` object.

For example, call `tool_call` with:

```json
{
  "tool_id": "open-pencil::render",
  "arguments": { "jsx": "<Frame name=\"Card\" w={320} h={200} />", "x": 100, "y": 100 }
}
```

The render payload examples in the authoring reference describe the contents of `arguments` in this mode. Never put `jsx`, coordinates, or node IDs beside `tool_id`. `{"tool_id":"open-pencil::render","arguments":{},"jsx":"..."}` sends an empty payload to MCP and cannot render anything.

Use the same wrapper for every discovered MCP tool. Keep tools with no parameters inside an empty `arguments` object. If the session exposes a tool directly instead of through a dispatcher, follow that direct tool's schema.
