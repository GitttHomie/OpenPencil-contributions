import { expect, test } from 'bun:test'

import { sameFigmaClipboardContent } from '#fig/clipboard/envelope'

const source =
  '<meta charset="utf-8"><span data-metadata="<!--(figmeta)bWV0YQ==(/figmeta)-->"></span><span data-buffer="<!--(figma)ZGVzaWdu(/figma)-->"></span>'

test('clipboard identity survives system HTML normalization', () => {
  const normalized = `<html><body>${source.replaceAll('<!--', '&lt;!--').replaceAll('-->', '--&gt;')}</body></html>`
  expect(sameFigmaClipboardContent(source, normalized)).toBe(true)
})

test('clipboard identity checks both metadata and design bytes', () => {
  expect(sameFigmaClipboardContent(source, source.replace('bWV0YQ==', 'b3RoZXI='))).toBe(false)
  expect(sameFigmaClipboardContent(source, source.replace('ZGVzaWdu', 'b3RoZXI='))).toBe(false)
  expect(sameFigmaClipboardContent(source, '<p>Unrelated text</p>')).toBe(false)
  expect(sameFigmaClipboardContent('', '')).toBe(false)
})
