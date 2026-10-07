import { afterEach, describe, expect, test, vi } from 'bun:test'

import { fontManager, fontResolver } from '@open-pencil/core/text'

import { clearTauriMocks, mockTauriIPC } from '#tests/helpers/tauri/mocks'

afterEach(async () => {
  await clearTauriMocks()
  vi.restoreAllMocks()
  fontResolver.reset()
})

describe('Tauri font helpers', () => {
  test('lists native faces and selects one without a web request', async () => {
    const calls: string[] = []
    await mockTauriIPC((cmd, args) => {
      calls.push(cmd)
      if (cmd === 'load_system_font') {
        expect(args).toEqual({ family: 'Academy Engraved LET', style: 'Regular' })
        return new Uint8Array([1, 2, 3, 4]).buffer
      }
      expect(cmd).toBe('list_system_fonts')
      return [{ family: 'Academy Engraved LET', styles: ['Regular'] }]
    })

    vi.spyOn(fontManager, 'listFamilyOptions').mockResolvedValue([])
    const { listFamilies, listFonts } = await import('@/app/editor/fonts')

    await expect(listFamilies()).resolves.toEqual([
      { family: 'Academy Engraved LET', source: 'local' }
    ])
    await expect(listFonts()).resolves.toEqual([
      { family: 'Academy Engraved LET', styles: ['Regular'] }
    ])
    const { typographyFontLoader } = await import('@/app/editor/fonts/selection')
    expect(typographyFontLoader.styles?.('Academy Engraved LET')).toEqual(['Regular'])
    await typographyFontLoader.load('Academy Engraved LET', 'Regular', 'Hello')
    expect(fontManager.loadedFontSource('Academy Engraved LET', 'Regular')).toBe('local')
    expect(calls).toEqual(['list_system_fonts', 'load_system_font'])
  })

  test('loads system font bytes and registers the face', async () => {
    await mockTauriIPC((cmd, args) => {
      expect(cmd).toBe('load_system_font')
      expect(args).toEqual({ family: 'System UI', style: 'Bold Italic' })
      return new Uint8Array([1, 2, 3, 4]).buffer
    })

    const { loadFont } = await import('@/app/editor/fonts')
    const buffer = await loadFont('System UI', 'Bold Italic')

    expect([...new Uint8Array(buffer ?? new ArrayBuffer(0))]).toEqual([1, 2, 3, 4])
    expect(fontManager.isLoaded('System UI', 'Bold Italic')).toBe(true)
  })

  test('records installed faces whose outlines cannot be drawn', async () => {
    await mockTauriIPC((cmd) => {
      expect(cmd).toBe('load_system_font')
      throw { code: 'unsupported-format', message: 'Font outlines are in an unsupported format' }
    })
    await import('@/app/editor/fonts')

    await expect(fontManager.loadLocalFont('Undrawable Sans', 'Regular')).resolves.toBeNull()
    expect(fontManager.unavailableReason('Undrawable Sans', 'Regular')).toBe('unsupported-format')
    expect(fontManager.unavailableReason('Undrawable Sans', 'Bold')).toBeNull()
  })

  test('falls back to font manager loading when the system font command fails', async () => {
    await mockTauriIPC((cmd) => {
      expect(cmd).toBe('load_system_font')
      throw new Error('missing system font')
    })
    const fallback = new Uint8Array([9, 8, 7]).buffer
    const loadFontSpy = vi.spyOn(fontManager, 'loadFont').mockResolvedValue(fallback)

    const { loadFont } = await import('@/app/editor/fonts')

    await expect(loadFont('Missing Family', 'Regular')).resolves.toBe(fallback)
    expect(loadFontSpy).toHaveBeenCalledWith('Missing Family', 'Regular', '', undefined)
  })

  test('online previews use cached or remote bytes without requesting local font access', async () => {
    const bytes = new ArrayBuffer(4)
    vi.spyOn(fontManager, 'loadedData').mockReturnValue(null)
    const cached = vi.spyOn(fontManager, 'loadCachedFont').mockResolvedValue(null)
    const remote = vi.spyOn(fontManager, 'loadRemoteFont').mockResolvedValue(bytes)
    const local = vi.spyOn(fontManager, 'loadLocalFont')
    const { loadWebFontPreview } = await import('@/app/editor/fonts')

    expect(await loadWebFontPreview('Web Preview')).toBe(bytes)
    expect(cached).toHaveBeenCalledWith('Web Preview', 'Regular', 'Web Preview')
    expect(remote).toHaveBeenCalledWith('Web Preview', 'Regular', 'Web Preview')
    expect(local).not.toHaveBeenCalled()
  })

  test('previews fetch missing family-name glyphs from a previously loaded subset', async () => {
    const subset = new ArrayBuffer(4)
    const complete = new ArrayBuffer(8)
    vi.spyOn(fontManager, 'loadedData').mockReturnValue(subset)
    vi.spyOn(fontManager, 'remoteStyleNeedsCoverage').mockReturnValue(true)
    vi.spyOn(fontManager, 'loadCachedFont').mockResolvedValue(null)
    const remote = vi.spyOn(fontManager, 'loadRemoteFont').mockResolvedValue(complete)
    const { loadWebFontPreview } = await import('@/app/editor/fonts')

    expect(await loadWebFontPreview('Preview')).toBe(complete)
    expect(remote).toHaveBeenCalledWith('Preview', 'Regular', 'Preview')
  })
})
