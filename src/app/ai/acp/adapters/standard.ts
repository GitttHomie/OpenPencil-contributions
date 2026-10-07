import type { ACPAgentID } from '@open-pencil/core/constants'

import { createCanvasPermissionScope } from '../canvas/permissions'
import type { ACPAgentAdapter } from './types'

/** Standard ACP needs no provider-specific notifications or group permission metadata. */
export function standardACPAdapter(id: ACPAgentID): ACPAgentAdapter {
  return {
    id,
    createSession: () => ({ permissions: createCanvasPermissionScope() })
  }
}
