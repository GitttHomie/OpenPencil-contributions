import { expect, test } from 'bun:test'
import { copyFile, mkdtemp, mkdir, rm, access } from 'node:fs/promises'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client'
import * as v from 'valibot'
import { WebSocket } from 'ws'

const bundle = process.env.OPENPENCIL_TEST_MCP_BUNDLE
const Health = v.object({ status: v.string(), bundled: v.literal(true) })
const Request = v.object({
  type: v.literal('request'),
  id: v.string(),
  command: v.string(),
  args: v.optional(v.unknown())
})

async function freePort(): Promise<number> {
  const server = createServer()
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('Missing test TCP port')
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve()))
  )
  return address.port
}

test.skipIf(!bundle)(
  'the packaged helper serves MCP without a runtime, checkout, or network download',
  async () => {
    if (!bundle) throw new Error('Set OPENPENCIL_TEST_MCP_BUNDLE to the packaged executable')
    const directory = await mkdtemp(join(tmpdir(), 'op-mcp-'))
    const executable = join(directory, process.platform === 'win32' ? 'helper.exe' : 'helper')
    const discovery = join(directory, 'mcp.json')
    const socket = join(directory, 'mcp.sock')
    await copyFile(bundle, executable)
    await mkdir(join(directory, 'empty-path'))
    const port = await freePort()
    const token = crypto.randomUUID()
    const url = `http://127.0.0.1:${port}`
    const denyRoot = process.env.OPENPENCIL_TEST_MCP_DENY_ROOT
    const command =
      process.platform === 'darwin' && denyRoot
        ? [
            '/usr/bin/sandbox-exec',
            '-p',
            `(version 1)(allow default)(deny file-read* (subpath ${JSON.stringify(denyRoot)}))(deny network-outbound)(allow network-outbound (remote ip "localhost:*"))`,
            executable
          ]
        : [executable]
    const child = Bun.spawn(command, {
      cwd: directory,
      env: {
        HOME: directory,
        PATH: join(directory, 'empty-path'),
        ...(process.platform === 'win32' ? { SystemRoot: process.env.SystemRoot } : {}),
        PORT: String(port),
        OPENPENCIL_MCP_ROOT: directory,
        OPENPENCIL_MCP_SOCKET: socket,
        OPENPENCIL_MCP_DISCOVERY_PATH: discovery,
        OPENPENCIL_MCP_AUTH_TOKEN: token,
        OPENPENCIL_MCP_APP_TIMEOUT_MS: '5000'
      },
      stdout: 'pipe',
      stderr: 'pipe'
    })
    const stderr = new Response(child.stderr).text()
    const client = new Client({ name: 'packaged-helper-test', version: '1' })
    let browser: WebSocket | undefined
    const requests: v.InferOutput<typeof Request>[] = []
    try {
      let healthy = false
      for (let attempt = 0; attempt < 80; attempt++) {
        if (child.exitCode !== null) throw new Error(await stderr)
        try {
          const response = await fetch(`${url}/health`)
          const parsed = v.safeParse(
            v.pipe(v.string(), v.parseJson(), Health),
            await response.text()
          )
          if (parsed.success) {
            healthy = true
            break
          }
        } catch {
          /* The listener has not started yet. */
        }
        await Bun.sleep(50)
      }
      expect(healthy).toBe(true)
      expect((await fetch(`${url}/mcp`, { method: 'POST' })).status).toBe(401)
      browser = new WebSocket(`ws://127.0.0.1:${port}`)
      const ws = browser
      ws.on('message', (data) => {
        const parsed = v.safeParse(v.pipe(v.string(), v.parseJson(), Request), data.toString())
        if (!parsed.success) return
        requests.push(parsed.output)
        ws.send(
          JSON.stringify({
            type: 'response',
            id: parsed.output.id,
            ok: true,
            result: { id: 'test-frame' }
          })
        )
      })
      await new Promise<void>((resolve, reject) => {
        ws.once('open', resolve)
        ws.once('error', reject)
      })
      ws.send(JSON.stringify({ type: 'register', token }))
      await client.connect(
        new StreamableHTTPClientTransport(new URL(`${url}/mcp`), {
          requestInit: { headers: { Authorization: `Bearer ${token}` } }
        })
      )
      const tools = await client.listTools()
      expect(tools.tools.some((tool) => tool.name === 'render')).toBe(true)
      // Both transports relay JSX to the app, which owns parsing and layout.
      const rendered = await client.callTool({
        name: 'render',
        arguments: { jsx: '<Frame name="Bundled" w={180} h={80} bg="#ff0000" />' }
      })
      expect(rendered.isError).not.toBe(true)
      expect(requests).toContainEqual(
        expect.objectContaining({
          command: 'tool',
          args: expect.objectContaining({ name: 'render' })
        })
      )
      const relayed = await fetch(`${url}/rpc`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          command: 'tool',
          args: { name: 'render', args: { jsx: '<Frame name="RPC" w={120} h={40} />' } }
        })
      })
      expect(relayed.ok).toBe(true)
      expect(requests).toContainEqual(
        expect.objectContaining({
          command: 'tool',
          args: expect.objectContaining({
            name: 'render',
            args: expect.objectContaining({ jsx: '<Frame name="RPC" w={120} h={40} />' })
          })
        })
      )
      await access(discovery)
      await client.close()
      ws.close()
      // A crashed/disconnected app must not leave its helper serving indefinitely.
      const exited = await Promise.race([child.exited, Bun.sleep(8000).then(() => 'timeout')])
      expect(exited).toBe(0)
      expect(await Bun.file(discovery).exists()).toBe(false)
    } finally {
      await client.close()
      browser?.terminate()
      if (child.exitCode === null) child.kill()
      await child.exited
      await rm(directory, { recursive: true, force: true })
    }
  },
  20000
)
