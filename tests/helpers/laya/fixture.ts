import { mockIPC } from '@tauri-apps/api/mocks'

mockIPC(async (command) => {
  if (command.startsWith('laya_')) {
    const response = await fetch(`/__test/laya/${command}`, { method: 'POST' })
    if (!response.ok) throw new Error('setup-failed')
    return response.json()
  }
  if (command === 'credential_store_availability') return { status: 'available' }
  if (command === 'credential_status') return 'missing'
  return null
})
await import('./mount')
