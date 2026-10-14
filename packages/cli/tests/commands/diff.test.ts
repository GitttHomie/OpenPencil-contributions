import { afterAll, beforeAll, describe, expect, setDefaultTimeout, test } from 'bun:test'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import * as v from 'valibot'

import { exportFigFile, initCodec, parseFigFile } from '@open-pencil/core'
import { SceneGraph } from '@open-pencil/scene-graph'

import { CLI_ENTRY } from '#cli-tests/helpers/paths'

setDefaultTimeout(60_000)

let fixture: string
let fixtureDir: string
let logoId: string
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47]

beforeAll(async () => {
  await initCodec()
  fixtureDir = await mkdtemp(join(tmpdir(), 'open-pencil-diff-fixture-'))
  fixture = join(fixtureDir, 'input.fig')
  const graph = new SceneGraph()
  graph.createNode('RECTANGLE', graph.getPages()[0].id, {
    name: 'Logo',
    width: 100,
    height: 100,
    fills: [{ type: 'SOLID', color: { r: 1, g: 0, b: 0, a: 1 }, opacity: 1, visible: true }]
  })
  const bytes = await exportFigFile(graph)
  await writeFile(fixture, bytes)
  const reopened = await parseFigFile(bytes.buffer as ArrayBuffer)
  const logo = [...reopened.getAllNodes()].find((node) => node.name === 'Logo')
  if (!logo) throw new Error('Missing diff fixture logo')
  logoId = logo.id
})

afterAll(async () => {
  if (fixtureDir) await rm(fixtureDir, { recursive: true, force: true })
})

async function cli(args: string[]) {
  const proc = Bun.spawn([process.execPath, CLI_ENTRY, ...args], { stdout: 'pipe', stderr: 'pipe' })
  const [stdout, stderr] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text()
  ])
  return { stdout: stdout.trim(), stderr: stderr.trim(), exitCode: await proc.exited }
}

describe('diff CLI', () => {
  test('show, apply, and files round-trip an attribute patch headlessly', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'open-pencil-diff-'))
    const patchPath = join(dir, 'logo.diff')
    const outPath = join(dir, 'out.fig')

    const shown = await cli([
      'diff',
      'show',
      logoId,
      fixture,
      '--attributes',
      'name="Brand" opacity={0.5}'
    ])
    expect(shown.exitCode).toBe(0)
    expect(shown.stdout).toBe(`@@ /Logo #${logoId}\n-name="Logo"\n+name="Brand"\n+opacity={0.5}`)
    await writeFile(patchPath, shown.stdout)

    const applied = await cli(['diff', 'apply', patchPath, fixture, '--output', outPath, '--json'])
    expect(applied.exitCode).toBe(0)
    expect(JSON.parse(applied.stdout)).toMatchObject({ applied: 1, failed: 0 })

    // Matched by path, the renamed logo reads as removed and added.
    const files = await cli(['diff', 'files', fixture, outPath, '--json'])
    // Like diff(1), a difference exits 1.
    expect(files.exitCode).toBe(1)
    const result = v.parse(
      v.pipe(v.string(), v.parseJson(), v.object({ diff: v.string() })),
      files.stdout
    )
    expect(result.diff).toContain(`/Logo #${logoId} removed`)
    expect(result.diff).toContain('opacity={0.5}')

    const stalePath = join(dir, 'stale.diff')
    await writeFile(stalePath, shown.stdout.replace('-name="Logo"', '-name="Other"'))
    const stale = await cli(['diff', 'apply', stalePath, fixture, '--dry-run', '--json'])
    expect(stale.exitCode).toBe(1)
    expect(stale.stdout).toContain('name: expected name=\\"Other\\", found name=\\"Logo\\"')
  })

  test.each([
    [['--page', 'Nope'], 'Neither document has a page named "Nope"'],
    [['--depth', 'abc'], '--depth must be a non-negative integer, got "abc"'],
    [['--depth=-1'], '--depth must be a non-negative integer, got "-1"']
  ])('files rejects %p instead of reporting a match', async (options, error) => {
    const result = await cli(['diff', 'files', fixture, fixture, ...options])
    expect(result.exitCode).toBe(2)
    expect(result.stderr).toContain(error)
  })

  test('visual writes a PNG and reports the changed area', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'open-pencil-diff-'))
    const output = join(dir, 'diff.png')

    const result = await cli([
      'diff',
      'visual',
      fixture,
      '--from',
      logoId,
      '--to',
      logoId,
      '--output',
      output,
      '--max-edge',
      '256',
      '--json'
    ])
    expect(result.exitCode).toBe(0)
    expect(JSON.parse(result.stdout)).toMatchObject({ changedPixels: 0, changedBounds: null })
    expect([...(await readFile(output)).subarray(0, 4)]).toEqual(PNG_SIGNATURE)
  })
})
