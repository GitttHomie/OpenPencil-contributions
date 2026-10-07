import { expect, test } from 'bun:test'

import { onScopeDispose } from 'vue'

import { scopedStoreFactory } from '@/app/editor/session/scope'

test('store effects are released even when store disposal fails', () => {
  let released = false
  const create = scopedStoreFactory(() => {
    onScopeDispose(() => {
      released = true
    })
    return {
      dispose() {
        throw new Error('dispose failed')
      }
    }
  })
  expect(() => create().dispose()).toThrow('dispose failed')
  expect(released).toBe(true)
})
