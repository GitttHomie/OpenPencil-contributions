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

function automaticApproval(params: RequestPermissionRequest, scope?: CanvasPermissionScope) {
  if (!scope || (!(scope.trusted && scope.canApprove(params)) && !scope.isRemembered(params)))
    return undefined
  return params.options.find((option) => option.kind === 'allow_once')
}

export function requestPermissionFromUser(
  params: RequestPermissionRequest,
  scope?: CanvasPermissionScope
): Promise<RequestPermissionResponse> {
  const allow = automaticApproval(params, scope)
  if (allow) {
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
  const option = entry.request.options.find((option) => option.optionId === optionId)
  if (!option) return
  if (option.kind === 'allow_always') entry.scope?.remember(entry.request)
  removeEntry(entry)
  entry.resolve({ outcome: { outcome: 'selected', optionId } })
  if (option.kind === 'allow_always') {
    for (const pending of permissionQueue.value) {
      const allow = automaticApproval(pending.request, pending.scope)
      if (!allow) continue
      removeEntry(pending)
      pending.resolve({ outcome: { outcome: 'selected', optionId: allow.optionId } })
    }
  }
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
