import { describe, expect, test } from 'bun:test'

import { classifyToolState, isMCPToolName, toolResultOutput } from '@/components/chat/tool-state'

describe('classifyToolState', () => {
  test('recognizes MCP tools by their names', () => {
    expect(isMCPToolName('mcp__server__search')).toBe(true)
    expect(isMCPToolName('mcp.open-pencil.get_selection')).toBe(true)
    expect(isMCPToolName('get_nodes')).toBe(false)
  })

  test('shows a successful Codex ACP response with error: null as done', () => {
    const result = {
      content: [{ type: 'text', text: '{"selection": []}' }],
      structuredContent: null,
      _meta: null
    }
    const output = { result, error: null }
    expect(
      classifyToolState({
        toolName: 'mcp.open-pencil.get_selection',
        state: 'output-available',
        output
      })
    ).toBe('done')
    expect(toolResultOutput(output)).toBe(result)
  })

  test('preserves real errors inside a completed Codex MCP response', () => {
    for (const output of [
      { result: null, error: 'RPC timeout' },
      {
        result: { content: [{ type: 'text', text: 'Node not found' }], isError: true },
        error: null
      }
    ]) {
      expect(
        classifyToolState({
          toolName: 'mcp.open-pencil.get_node',
          state: 'output-available',
          output
        })
      ).toBe('error')
    }
  })

  test('treats omitted and false MCP isError as success', () => {
    expect(
      classifyToolState({
        toolName: 'mcp__server__search',
        state: 'output-available',
        output: { content: [{ type: 'text', text: 'ok' }] }
      })
    ).toBe('done')
    expect(
      classifyToolState({
        toolName: 'mcp__server__search',
        state: 'output-available',
        output: { content: [], isError: false }
      })
    ).toBe('done')
  })

  test('treats true MCP isError as an error', () => {
    expect(
      classifyToolState({
        toolName: 'mcp__server__search',
        state: 'output-available',
        output: { content: [], isError: true }
      })
    ).toBe('error')
  })

  test('does not classify non-MCP content objects as MCP results', () => {
    expect(
      classifyToolState({
        toolName: 'get_nodes',
        state: 'output-available',
        output: { content: [] }
      })
    ).toBe('done')
  })

  test('preserves generic error precedence', () => {
    expect(
      classifyToolState({
        toolName: 'mcp__server__search',
        state: 'output-available',
        output: { content: [], error: 'failed' }
      })
    ).toBe('error')
    expect(
      classifyToolState({
        toolName: 'mcp__server__search',
        state: 'output-error',
        output: { content: [] }
      })
    ).toBe('error')
  })
})
