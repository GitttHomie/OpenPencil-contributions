// Vite's bundled config rewrites import.meta.resolve to a virtual module that Bun cannot load.
// eslint-disable-next-line no-restricted-imports -- resolve only package metadata in the Node build config
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'

import { FileSystemIconLoader } from 'unplugin-icons/loaders'

/**
 * Monochrome provider and agent logos from LobeHub, used as `<icon-ai-openai />` or
 * `~icons/ai/openai`. They draw with `currentColor` on a 24px grid, like Lucide.
 */
export function aiIconCollection() {
  const manifest = createRequire(import.meta.url).resolve('@lobehub/icons-static-svg/package.json')
  const icons = join(dirname(manifest), 'icons')
  // Titles would add tooltips and duplicate the accessible name of the label beside the logo.
  return FileSystemIconLoader(icons, (svg) => svg.replace(/<title>.*?<\/title>/, ''))
}
