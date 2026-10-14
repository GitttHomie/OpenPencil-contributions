import { mkdir, readFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'

import { resolveWorkspaceRoot } from '../workspace/root'
import { writeMCPNotices } from './notices'

const targets = {
  'aarch64-apple-darwin': 'bun-darwin-arm64',
  'x86_64-apple-darwin': 'bun-darwin-x64',
  'x86_64-unknown-linux-gnu': 'bun-linux-x64',
  'aarch64-unknown-linux-gnu': 'bun-linux-arm64',
  'x86_64-pc-windows-msvc': 'bun-windows-x64',
  'aarch64-pc-windows-msvc': 'bun-windows-arm64'
} as const

export async function buildDesktopMCP(root: string, target: string): Promise<string> {
  if (!Object.hasOwn(targets, target)) throw new Error(`Unsupported MCP sidecar target: ${target}`)
  const runtimeTarget = targets[target as keyof typeof targets]
  const directory = join(root, 'desktop/binaries')
  await mkdir(directory, { recursive: true })
  const outfile = join(
    directory,
    `openpencil-mcp-http-${target}${target.includes('windows') ? '.exe' : ''}`
  )
  const result = await Bun.build({
    entrypoints: [join(root, 'packages/mcp/src/index.ts')],
    tsconfig: join(root, 'tsconfig.json'),
    metafile: true,
    define: { 'process.env.OPENPENCIL_MCP_BUNDLED': '"1"' },
    compile: {
      target: runtimeTarget,
      outfile,
      autoloadBunfig: false,
      autoloadDotenv: false,
      autoloadPackageJson: false,
      autoloadTsconfig: false
    },
    plugins: [
      {
        name: 'standalone-mcp-assets',
        setup(build) {
          // css-tree's normal ESM entry loads JSON through createRequire at runtime.
          // Its published standalone distribution embeds the same syntax dictionaries.
          build.onResolve({ filter: /^css-tree$/ }, (args) => ({
            path: Bun.resolveSync('css-tree/dist/csstree.esm', args.resolveDir)
          }))
          build.onResolve({ filter: /\?raw$/ }, (args) => ({
            path: resolve(args.resolveDir, args.path.slice(0, -4)),
            namespace: 'raw-text'
          }))
          build.onLoad({ filter: /.*/, namespace: 'raw-text' }, async (args) => ({
            contents: await readFile(args.path, 'utf8'),
            loader: 'text'
          }))
        }
      }
    ]
  })
  if (!result.success) throw new AggregateError(result.logs, 'Could not compile the MCP sidecar')
  if (!result.metafile) throw new Error('Missing bundled dependency metadata')
  await writeMCPNotices(root, Object.keys(result.metafile.inputs))
  return outfile
}

if (import.meta.main) {
  const root = await resolveWorkspaceRoot(process.cwd())
  const host = Bun.spawnSync(['rustc', '-vV'])
  if (host.exitCode !== 0) throw new Error('Could not determine the Rust host target')
  const hostTarget = host.stdout.toString().match(/^host: (.+)$/m)?.[1]
  const target = process.argv[2] ?? process.env.TAURI_ENV_TARGET_TRIPLE ?? hostTarget
  if (!target) throw new Error('Missing desktop target')
  console.log(await buildDesktopMCP(root, target))
}
