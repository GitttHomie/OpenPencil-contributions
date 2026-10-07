import { resolveAIModelRole } from '@/app/ai/models'

export function hasFastRoutingTarget(): boolean {
  const fast = resolveAIModelRole('fast')
  return Boolean(
    fast &&
    fast.profile.id !== resolveAIModelRole('design')?.profile.id &&
    fast.profile.capabilities.includes('tools') &&
    fast.connection.providerID !== 'harness:pi'
  )
}
