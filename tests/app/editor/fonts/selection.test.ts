import { expect, test } from 'bun:test'

import { fontManager, fontResolver } from '@open-pencil/core/text'

import { clearTauriMocks, mockTauriIPC } from '#tests/helpers/tauri/mocks'

test('desktop typography uses the installed catalog and resolves a local face without web requests', async () => {
  const calls: Array<{ command: string; args: unknown }> = []
  await mockTauriIPC((command, args) => {
    calls.push({ command, args })
    if (command === 'list_system_fonts') {
      return [{ family: 'Academy Engraved LET', styles: ['Regular'] }]
    }
    if (command === 'load_system_font') return new ArrayBuffer(8)
    throw new Error(`Unexpected native command: ${command}`)
  })
  try {
    const { listFonts } = await import('@/app/editor/fonts')
    const { typographyFontLoader } = await import('@/app/editor/fonts/selection')
    await listFonts()
    expect(typographyFontLoader.styles?.('Academy Engraved LET')).toEqual(['Regular'])
    await typographyFontLoader.load('Academy Engraved LET', 'Regular', 'Hello')
    expect(fontManager.loadedFontSource('Academy Engraved LET', 'Regular')).toBe('local')
    expect(calls).toEqual([
      { command: 'list_system_fonts', args: {} },
      { command: 'load_system_font', args: { family: 'Academy Engraved LET', style: 'Regular' } }
    ])
  } finally {
    fontResolver.reset()
    await clearTauriMocks()
  }
})
