import type { RequestPermissionRequest, RequestPermissionResponse } from '@agentclientprotocol/sdk'
import { computed, shallowRef } from 'vue'

import { ACP_PERMISSION_TIMEOUT_MS } from '@/constants'

import type { CanvasPermissionScope } from './canvas-permissions'

export interface PendingPermission {
  request: RequestPermissionRequest
  resolve: (response: RequestPermissionResponse) => void
  timer: ReturnType<typeof setTimeout>
  scope?: CanvasPermissionScope
}

export const permissionQueue = shallowRef<PendingPermission[]>([])
export const currentPermission = computed(() => permissionQueue.value.at(0) ?? null)

function rejection(request: RequestPermissionRequest): RequestPermissionResponse {
  const reject = request.options.find((o) => o.kind.startsWith('reject'))
  return reject
    ? { outcome: { outcome: 'selected', optionId: reject.optionId } }
    : { outcome: { outcome: 'cancelled' } }
}

function removeEntry(entry: PendingPermission) {
  clearTimeout(entry.timer)
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
    const timer = setTimeout(() => {
      removeEntry(entry)
      resolve(rejection(params))
    }, ACP_PERMISSION_TIMEOUT_MS)

    const entry: PendingPermission = { request: params, resolve, timer, scope }
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

export function rejectCurrentPermission() {
  const entry = permissionQueue.value.at(0)
  if (!entry) return
  removeEntry(entry)
  entry.resolve(rejection(entry.request))
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
