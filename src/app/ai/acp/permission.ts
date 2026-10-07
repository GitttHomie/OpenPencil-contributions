import type { RequestPermissionRequest, RequestPermissionResponse } from '@agentclientprotocol/sdk'
import { computed, shallowRef } from 'vue'

import type { CanvasPermissionScope } from './canvas/permissions'

export interface PendingPermission {
  request: RequestPermissionRequest
  resolve: (response: RequestPermissionResponse) => void
  scope?: CanvasPermissionScope
}

export const permissionQueue = shallowRef<PendingPermission[]>([])
export const currentPermission = computed(() => permissionQueue.value.at(0) ?? null)

function removeEntry(entry: PendingPermission) {
  permissionQueue.value = permissionQueue.value.filter((e) => e !== entry)
}

export function requestPermissionFromUser(
  params: RequestPermissionRequest,
  scope?: CanvasPermissionScope
): Promise<RequestPermissionResponse> {
  const allow = params.options.find((option) => option.kind === 'allow_once')
  if (scope?.trusted && scope.canApprove(params) && allow) {
    return Promise.resolve({ outcome: { outcome: 'selected', optionId: allow.optionId } })
  }
  return new Promise((resolve) => {
    // Waiting is not a rejection. The user or session teardown must resolve this request.
    const entry: PendingPermission = { request: params, resolve, scope }
    permissionQueue.value = [...permissionQueue.value, entry]
  })
}

export function respondToPermission(optionId: string) {
  const entry = permissionQueue.value.at(0)
  if (!entry) return
  if (!entry.request.options.some((option) => option.optionId === optionId)) return
  removeEntry(entry)
  entry.resolve({ outcome: { outcome: 'selected', optionId } })
}

export function cancelCurrentPermission() {
  const entry = permissionQueue.value.at(0)
  if (!entry) return
  removeEntry(entry)
  entry.resolve({ outcome: { outcome: 'cancelled' } })
}

export const canAllowCanvasForChat = computed(() => {
  const entry = currentPermission.value
  return Boolean(
    entry?.scope?.canApprove(entry.request) &&
    entry.request.options.some((option) => option.kind === 'allow_once')
  )
})

export function allowCanvasForChat() {
  const entry = currentPermission.value
  const scope = entry?.scope
  if (!entry || !scope || !canAllowCanvasForChat.value) return
  scope.trusted = true
  for (const pending of permissionQueue.value) {
    if (pending.scope !== scope || !scope.canApprove(pending.request)) continue
    const allow = pending.request.options.find((option) => option.kind === 'allow_once')
    if (!allow) continue
    removeEntry(pending)
    pending.resolve({ outcome: { outcome: 'selected', optionId: allow.optionId } })
  }
}

export function cancelPermissionsForScope(scope: CanvasPermissionScope) {
  for (const entry of permissionQueue.value) {
    if (entry.scope !== scope) continue
    removeEntry(entry)
    entry.resolve({ outcome: { outcome: 'cancelled' } })
  }
}
