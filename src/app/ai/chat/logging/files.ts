import { sessionLogText, type SessionLog } from './types'

export async function sessionLogDirectory(): Promise<string> {
  const { appLogDir, join } = await import('@tauri-apps/api/path')
  return join(await appLogDir(), 'ai-sessions')
}

function safeId(id: string): string {
  if (!/^[a-f0-9-]{36}$/i.test(id)) throw new Error('Invalid log identifier')
  return id
}

export async function writeSessionLogFiles(log: SessionLog, writtenAssets: Set<string>) {
  const { join } = await import('@tauri-apps/api/path')
  const { mkdir, writeFile } = await import('@tauri-apps/plugin-fs')
  const directory = await join(await sessionLogDirectory(), safeId(log.id))
  await mkdir(await join(directory, 'images'), { recursive: true })
  for (const asset of log.assets) {
    const key = `${log.id}/${asset.name}`
    if (writtenAssets.has(key)) continue
    if (!/^images\/\d+\.(png|jpg|webp|gif)$/.test(asset.name)) throw new Error('Invalid image name')
    await writeFile(await join(directory, asset.name), asset.bytes)
    writtenAssets.add(key)
  }
  await writeFile(
    await join(directory, 'session.jsonl'),
    new TextEncoder().encode(sessionLogText(log))
  )
}

export async function removeSessionLogFiles(ids: string[]) {
  const { join } = await import('@tauri-apps/api/path')
  const { remove } = await import('@tauri-apps/plugin-fs')
  const directory = await sessionLogDirectory()
  for (const id of ids) await remove(await join(directory, safeId(id)), { recursive: true })
}

export async function revealSessionLogs() {
  const { mkdir } = await import('@tauri-apps/plugin-fs')
  const { revealItemInDir } = await import('@tauri-apps/plugin-opener')
  const directory = await sessionLogDirectory()
  await mkdir(directory, { recursive: true })
  await revealItemInDir(directory)
}
