import { zip, type AsyncZippable } from 'fflate'

import { saveExportedFile } from '@/app/document/export/files'
import { downloadBlob } from '@/app/document/io/browser'

import { sessionLogs } from './service'
import { sessionLogText } from './types'

/** An inspectable archive: one readable JSONL file per run and original image attachments. */
export async function exportSessionLogs() {
  const files: AsyncZippable = {}
  for (const log of await sessionLogs.list()) {
    files[`${log.id}/session.jsonl`] = new TextEncoder().encode(sessionLogText(log))
    for (const asset of log.assets) files[`${log.id}/${asset.name}`] = [asset.bytes, { level: 0 }]
  }
  const bytes = await new Promise<Uint8Array>((resolve, reject) => {
    zip(files, { level: 1 }, (error, result) => {
      if (error) {
        reject(error)
        return
      }
      resolve(result)
    })
  })
  await saveExportedFile(
    bytes,
    'openpencil-ai-sessions.zip',
    'ZIP',
    '.zip',
    'application/zip',
    downloadBlob
  )
}
