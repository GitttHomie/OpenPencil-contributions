import { tryOnScopeDispose } from '@vueuse/core'
import { computed, ref, watch } from 'vue'

import { parseMCPImport } from '../configuration'
import { saveMCPEnvironment } from '../environment'
import { mcpConnectionSettings, saveMCPConnectionDraft } from '../store'

export function useMCPImport() {
  const text = ref('')
  const busy = ref(false)
  const failed = ref(false)
  const candidates = ref<ReturnType<typeof parseMCPImport>>([])
  watch(
    text,
    (value) => {
      failed.value = false
      try {
        candidates.value = parseMCPImport(value)
      } catch {
        candidates.value = []
      }
    },
    { flush: 'sync' }
  )
  const names = computed(() => candidates.value.map(({ draft }) => draft.name))
  tryOnScopeDispose(() => {
    text.value = ''
  })
  async function apply() {
    if (busy.value || !candidates.value.length) return false
    busy.value = true
    failed.value = false
    const imports = [...candidates.value]
    try {
      const seen = new Set<string>()
      for (const { draft } of imports) {
        const name = draft.name.trim().toLowerCase()
        if (
          !name ||
          name.length > 80 ||
          name === 'open-pencil' ||
          seen.has(name) ||
          mcpConnectionSettings.value.connections.some(
            (c) => c.id !== draft.id && c.name.toLowerCase() === name
          )
        ) {
          throw new Error('Duplicate or invalid MCP name.')
        }
        seen.add(name)
      }
      for (const candidate of imports) {
        const desired = {
          ...candidate.draft,
          hasEnvironment: Object.keys(candidate.environment).length > 0
        }
        const saved = saveMCPConnectionDraft({ ...desired, enabled: false })
        candidate.draft.id = saved.id
        if (desired.hasEnvironment) {
          await saveMCPEnvironment(saved.id, JSON.stringify(candidate.environment))
        }
        saveMCPConnectionDraft({ ...desired, id: saved.id })
      }
      text.value = ''
      return true
    } catch {
      failed.value = true
      return false
    } finally {
      busy.value = false
    }
  }
  return { text, busy, failed, names, apply }
}
