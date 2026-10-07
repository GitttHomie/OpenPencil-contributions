import { expect, test } from 'bun:test'

import { createApp, effectScope, reactive, ref } from 'vue'

import { agentModelVerifierKey } from '@/app/ai/agents/verification'
import type { ProviderConnectionTestResult } from '@/app/ai/chat/connection-test'
import { createModelProfileDraft } from '@/app/ai/models'
import { useProfileConnection } from '@/app/ai/models/settings/profile-editor/connection'
import { createDeferred } from '@/app/runtime/deferred'

test('a changed model cancels verification and discards a late success', async () => {
  const gate = createDeferred<ProviderConnectionTestResult>()
  const draft = reactive(createModelProfileDraft())
  draft.providerID = 'acp:codex'
  draft.modelID = 'first'
  let signal: AbortSignal | undefined
  const app = createApp({}).provide(agentModelVerifierKey, async (_target, abort) => {
    signal = abort
    return gate.promise
  })
  const scope = effectScope()
  const state = app.runWithContext(() =>
    scope.run(() => useProfileConnection({ draft, keyInput: ref('') }))
  )
  if (!state) throw new Error('Connection state missing')
  try {
    const pending = state.testConnection()
    expect(state.connectionTestStatus.value).toBe('testing')
    draft.modelID = 'second'
    expect(signal?.aborted).toBe(true)
    gate.resolve({ ok: true })
    await pending
    expect(state.connectionTestStatus.value).toBe('idle')
  } finally {
    scope.stop()
  }
})

test('successful verification is invalidated when endpoint, thinking or credentials change', async () => {
  const draft = reactive(createModelProfileDraft())
  draft.providerID = 'acp:codex'
  const keyInput = ref('')
  let calls = 0
  const app = createApp({}).provide(agentModelVerifierKey, async () => {
    calls++
    return { ok: true }
  })
  const scope = effectScope()
  const state = app.runWithContext(() => scope.run(() => useProfileConnection({ draft, keyInput })))
  if (!state) throw new Error('Connection state missing')
  try {
    expect(calls).toBe(0)
    await state.testConnection()
    expect(state.connectionTestStatus.value).toBe('success')
    draft.acpLaunch = { codexProvider: 'other' }
    expect(state.connectionTestStatus.value).toBe('idle')
    await state.testConnection()
    draft.acpThinking = { configId: 'effort', value: 'low' }
    expect(state.connectionTestStatus.value).toBe('idle')
    await state.testConnection()
    keyInput.value = 'replacement'
    expect(state.connectionTestStatus.value).toBe('idle')
    expect(calls).toBe(3)
  } finally {
    scope.stop()
  }
})
