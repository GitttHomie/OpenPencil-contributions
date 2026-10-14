import { ref } from 'vue'

import { exportSessionLogs } from './export'
import { revealSessionLogs } from './files'
import { sessionLogs } from './service'

export function useSessionLogActions() {
  const busy = ref(false)
  const failed = ref(false)
  async function run(action: () => Promise<unknown>) {
    if (busy.value) return
    busy.value = true
    failed.value = false
    try {
      await action()
    } catch {
      failed.value = true
    } finally {
      busy.value = false
    }
  }
  return {
    busy,
    failed,
    exportLogs: () => run(exportSessionLogs),
    revealLogs: () => run(revealSessionLogs),
    clearLogs: () => run(() => sessionLogs.clear())
  }
}
