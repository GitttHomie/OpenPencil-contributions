import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'

import { readPackageJSON } from 'pkg-types'

/** Include notices from the packages actually traversed by the standalone build. */
export async function writeMCPNotices(root: string, inputs: string[]): Promise<void> {
  const packages = new Set<string>()
  for (const input of inputs) {
    const path = resolve(root, input).replaceAll('\\', '/')
    const index = path.lastIndexOf('/node_modules/')
    if (index < 0) continue
    const base = index + '/node_modules/'.length
    const parts = path.slice(base).split('/')
    const count = parts[0].startsWith('@') ? 2 : 1
    packages.add(path.slice(0, base) + parts.slice(0, count).join('/'))
  }
  const sections = [
    `OpenPencil bundled canvas helper\n\n${await readFile(join(root, 'LICENSE'), 'utf8')}`,
    `Bun ${Bun.version}\nSource and rebuild instructions: https://github.com/oven-sh/bun/tree/bun-v${Bun.version}\n\n${await readFile(new URL('../../assets/bun-license.md', import.meta.url), 'utf8')}`
  ]
  for (const directory of [...packages].sort()) {
    const manifest = await readPackageJSON(join(directory, 'package.json'))
    const files = (await readdir(directory)).filter((name) =>
      /^(licen[sc]e|copying|notice)([-.].*)?$/i.test(name)
    )
    const notices = await Promise.all(
      files.sort().map((name) => readFile(join(directory, name), 'utf8'))
    )
    sections.push(
      `${manifest.name} ${manifest.version} (${manifest.license ?? 'see package source'})\n\n${notices.join('\n\n')}`
    )
  }
  const directory = join(root, 'desktop/binaries')
  await mkdir(directory, { recursive: true })
  await writeFile(
    join(directory, 'mcp-notices.txt'),
    sections.join('\n\n----------------------------------------\n\n')
  )
}
