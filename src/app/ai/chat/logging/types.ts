export interface SessionLogEvent {
  sequence: number
  timestamp: number
  elapsedMs: number
  type: string
  data: unknown
}

export interface SessionLogAsset {
  name: string
  mimeType: string
  bytes: Uint8Array
}

export interface SessionLog {
  version: 1
  id: string
  sessionId: string
  startedAt: number
  status: 'running' | 'completed' | 'stopped' | 'failed' | 'disconnected'
  events: SessionLogEvent[]
  assets: SessionLogAsset[]
}

export const SESSION_LOG_RETENTION = 20
export const SESSION_LOG_TEXT_LIMIT = 2 * 1024 * 1024
export const SESSION_LOG_ASSET_LIMIT = 8 * 1024 * 1024

export function sessionLogText(log: SessionLog): string {
  const { events, assets, ...header } = log
  return [
    JSON.stringify({
      type: 'session',
      ...header,
      assets: assets.map(({ bytes, ...asset }) => ({
        ...asset,
        byteLength: bytes.byteLength
      }))
    }),
    ...events.map((event) => JSON.stringify(event)),
    ''
  ].join('\n')
}
