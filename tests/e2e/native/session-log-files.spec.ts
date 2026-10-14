import { strict as assert } from 'node:assert'
import { join } from 'node:path'

import { BaseDirectory } from '@tauri-apps/api/path'

import { invokeNative, invokeNativeBytes, writeNativeFile } from '#tests/helpers/tauri/invoke'

describe('desktop session log storage', () => {
  it('writes, reads and removes logs in the isolated application log directory', async () => {
    const root = await invokeNative<string>('plugin:path|resolve_directory', {
      directory: BaseDirectory.AppLog
    })
    assert.match(root, /native-test/, 'Never write test logs into the production app directory')
    const directory = join(root, 'ai-sessions', crypto.randomUUID())
    await invokeNative('plugin:fs|mkdir', {
      path: join(directory, 'images'),
      options: { recursive: true }
    })
    try {
      const path = join(directory, 'session.jsonl')
      const content = '{"type":"session","status":"completed"}\n'
      assert.equal(await writeNativeFile(path, content), null)
      const bytes = await invokeNativeBytes('plugin:fs|read_file', { path })
      assert.equal(new TextDecoder().decode(new Uint8Array(bytes)), content)
    } finally {
      await invokeNative('plugin:fs|remove', { path: directory, options: { recursive: true } })
    }
  })
})
