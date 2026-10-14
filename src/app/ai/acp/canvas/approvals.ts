import { useLocalStorage } from '@vueuse/core'
import * as v from 'valibot'
import { computed } from 'vue'

const approvalSchema = v.array(v.object({ agent: v.string(), tool: v.string() }))
const saved = useLocalStorage('open-pencil:canvas-tool-approvals:v1', '[]', {
  writeDefaults: false,
  flush: 'sync'
})

export const rememberedCanvasApprovals = computed(() => {
  const result = v.safeParse(v.pipe(v.string(), v.parseJson(), approvalSchema), saved.value)
  return result.success ? result.output : []
})

export function hasCanvasApproval(agent: string, tool: string): boolean {
  return rememberedCanvasApprovals.value.some(
    (approval) => approval.agent === agent && approval.tool === tool
  )
}

export function rememberCanvasApproval(agent: string, tool: string) {
  if (hasCanvasApproval(agent, tool)) return
  saved.value = JSON.stringify([...rememberedCanvasApprovals.value, { agent, tool }])
}

export function resetCanvasApprovals() {
  saved.value = '[]'
}
