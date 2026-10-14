import type { DBSchema } from 'idb'

import {
  APP_DATABASE_NAMES,
  connectAppDatabase,
  defineAppDatabase,
  binaryStorage,
  readStoredBinary,
  type StoredBinary
} from '@/app/storage/idb'

import { SESSION_LOG_RETENTION, type SessionLog } from './types'

type StoredLog = Omit<SessionLog, 'assets'> & {
  assets: { name: string; mimeType: string; bytes: StoredBinary }[]
}
interface SessionDatabase extends DBSchema {
  runs: { key: string; value: StoredLog; indexes: { startedAt: number } }
}
const definition = defineAppDatabase<SessionDatabase>({
  name: APP_DATABASE_NAMES.aiSessions,
  version: 1,
  callbacks: {
    upgrade(db) {
      db.createObjectStore('runs', { keyPath: 'id' }).createIndex('startedAt', 'startedAt')
    }
  }
})

export function createSessionLogStore() {
  const database = connectAppDatabase(definition)
  return {
    async write(log: SessionLog): Promise<string[]> {
      const storeBinary = await binaryStorage()
      const stored: StoredLog = {
        ...log,
        assets: log.assets.map((asset) => ({ ...asset, bytes: storeBinary(asset.bytes) }))
      }
      const db = await database.open()
      const transaction = db.transaction('runs', 'readwrite')
      await transaction.store.put(stored)
      const keys = await transaction.store.index('startedAt').getAllKeys()
      const expired = keys.slice(0, Math.max(0, keys.length - SESSION_LOG_RETENTION))
      for (const id of expired) await transaction.store.delete(id)
      await transaction.done
      return expired
    },
    async list(): Promise<SessionLog[]> {
      const rows = (await (await database.open()).getAllFromIndex('runs', 'startedAt')).reverse()
      return Promise.all(
        rows.map(async (row) => ({
          ...row,
          assets: await Promise.all(
            row.assets.map(async (asset) => ({
              ...asset,
              bytes: (await readStoredBinary(asset.bytes)) ?? new Uint8Array()
            }))
          )
        }))
      )
    },
    async clear() {
      await (await database.open()).clear('runs')
    }
  }
}
