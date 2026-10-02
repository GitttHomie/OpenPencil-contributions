export function readFigmaClipboardEnvelope(html: string) {
  const metadata = html.match(/\(figmeta\)(.*?)\(\/figmeta\)/)?.[1]
  const buffer = html.match(/\(figma\)(.*?)\(\/figma\)/s)?.[1]
  return metadata && buffer ? { metadata, buffer } : null
}

/** System clipboards may normalize HTML while retaining the same encoded design. */
export function sameFigmaClipboardContent(left: string, right: string): boolean {
  const a = readFigmaClipboardEnvelope(left)
  const b = readFigmaClipboardEnvelope(right)
  return !!a && !!b && a.metadata === b.metadata && a.buffer === b.buffer
}
