import type { UIMessageChunk } from 'ai'
import { toUint8Array } from 'js-base64'

import { scrubSessionText } from '@/app/diagnostics/scrub'

import { projectChatMedia } from '../media'
import { SESSION_LOG_ASSET_LIMIT, SESSION_LOG_TEXT_LIMIT, type SessionLog } from './types'

const SECRET_FIELD =
  /^(?:authorization|cookie|set-cookie|password|token|api[_-]?key|access[_-]?token|refresh[_-]?token|secret|client[_-]?secret|env|headers)$/i

function redact(value: unknown): unknown {
  if (typeof value === 'string') return scrubSessionText(value)
  if (Array.isArray(value)) return value.map(redact)
  if (typeof value !== 'object' || value === null) return value
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [
      key,
      SECRET_FIELD.test(key) ? '[redacted]' : redact(item)
    ])
  )
}

/** Bounded run capture; token deltas coalesce before projection, redaction and persistence. */
export function createSessionCapture(
  sessionId: string,
  id: string,
  changed: (log: SessionLog) => void,
  now = Date.now
) {
  const log: SessionLog = {
    version: 1,
    id,
    sessionId,
    startedAt: now(),
    status: 'running',
    events: [],
    assets: []
  }
  let textSize = 0
  let assetSize = 0
  let limited = false
  let pending: { type: string; id: string; text: string } | null = null
  const assets = new Map<string, string>()
  function record(type: string, data: unknown) {
    if (limited) return
    const projected = projectChatMedia(data, (image) => {
      const existing = assets.get(image.url)
      if (existing) return `[Image: ${existing}]`
      if (assetSize + image.byteLength > SESSION_LOG_ASSET_LIMIT) {
        return `[Image omitted: asset limit; ${image.mimeType}, ${image.byteLength} bytes]`
      }
      const extension = image.mimeType === 'image/jpeg' ? 'jpg' : image.mimeType.slice(6)
      const name = `images/${log.assets.length + 1}.${extension}`
      const bytes = toUint8Array(image.url.slice(image.url.indexOf(',') + 1))
      log.assets.push({ name, mimeType: image.mimeType, bytes })
      assets.set(image.url, name)
      assetSize += bytes.byteLength
      return `[Image: ${name}]`
    }).value
    textSize += new TextEncoder().encode(JSON.stringify(projected)).byteLength
    if (textSize > SESSION_LOG_TEXT_LIMIT) limited = true
    const safe = limited ? null : redact(projected)
    const timestamp = now()
    log.events.push({
      sequence: log.events.length,
      timestamp,
      elapsedMs: timestamp - log.startedAt,
      type: limited ? 'log.limit' : type,
      data: limited ? { reason: 'Text limit reached; subsequent content omitted.' } : safe
    })
    changed(log)
  }
  function flush() {
    if (!pending) return
    const value = pending
    pending = null
    record(value.type, { id: value.id, text: value.text })
  }
  return {
    log,
    record(type: string, data: unknown) {
      flush()
      record(type, data)
    },
    observe(chunk: UIMessageChunk) {
      if (limited) return
      if (chunk.type === 'text-delta' || chunk.type === 'reasoning-delta') {
        if (pending?.id !== chunk.id || pending.type !== chunk.type) flush()
        pending ??= { type: chunk.type, id: chunk.id, text: '' }
        pending.text += chunk.delta
        if (pending.text.length >= 64 * 1024) flush()
        return
      }
      // Complete tool inputs arrive as tool-input-available/error; don't store each token twice.
      if (chunk.type === 'tool-input-delta') return
      flush()
      record(chunk.type, chunk)
    },
    checkpoint() {
      flush()
      return log
    },
    finish(status: SessionLog['status'], detail?: unknown) {
      flush()
      log.status = status
      record('run.finish', { status, detail })
      // Even a content-limited log must retain its final status.
      changed(log)
      assets.clear()
    }
  }
}
