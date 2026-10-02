import { expect, test } from 'bun:test'

import { fontCatalogStyles } from '#core/text/web-font/catalog'
import { WebFontResolver } from '#core/text/web-fonts'

test('Google static families expose only their published weight and slant', () => {
  const catalog = fontCatalogStyles('google', [
    { family: 'Abril Fatface', fonts: { '400': {} }, axes: [] },
    { family: 'Two faces', fonts: { '400': {}, '700i': {} }, axes: [] }
  ])
  expect(catalog.get('Abril Fatface')).toEqual(['Regular'])
  expect(catalog.get('Two faces')).toEqual(['Regular', 'Bold Italic'])
})

test('variable weights are limited to the declared range and available slants', () => {
  const catalog = fontCatalogStyles('google', [
    {
      family: 'Variable',
      fonts: { '400': {}, '400i': {} },
      axes: [{ tag: 'wght', min: 300, max: 700 }]
    }
  ])
  expect(catalog.get('Variable')).toContain('SemiBold Italic')
  expect(catalog.get('Variable')).toContain('Light')
  expect(catalog.get('Variable')).not.toContain('ExtraBold')
  expect(catalog.get('Variable')).toHaveLength(10)
})

test('Fontsource and Fontshare preserve supported styles', () => {
  expect(
    fontCatalogStyles('fontsource', [
      {
        family: 'Static',
        weights: [400],
        styles: ['normal']
      }
    ]).get('Static')
  ).toEqual(['Regular'])
  expect(
    fontCatalogStyles('fontshare', [
      {
        name: 'Display',
        styles: [{ weight: { weight: 600 }, is_italic: true }]
      }
    ]).get('Display')
  ).toEqual(['SemiBold Italic'])
})

test('family listing reuses Unifont metadata without extra font requests', async () => {
  const resolver = new WebFontResolver()
  resolver.setEnabled({ google: true })
  const requests: string[] = []
  resolver.setRemoteFetch(async (url) => {
    requests.push(url)
    return Response.json({
      familyMetadataList: [
        {
          family: 'Abril Fatface',
          fonts: { '400': {} },
          axes: []
        }
      ]
    })
  })
  expect(await resolver.listFamilies('google')).toEqual(['Abril Fatface'])
  expect(resolver.familyStyles('Abril Fatface')).toEqual(['Regular'])
  expect(requests).toHaveLength(1)
  resolver.setEnabled({})
  expect(resolver.familyStyles('Abril Fatface')).toEqual([])
})
