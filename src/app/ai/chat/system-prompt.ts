import { DESIGN_WORKFLOW } from '@open-pencil/core/tools'
import { JSX_REFERENCE } from '@open-pencil/design-jsx'

import EXTERNAL_TOOL_GUIDANCE from './external-guidance'
import behavior from './system-prompt.md?raw'

/**
 * Chat and ACP share scene-authoring knowledge without copying the renderer reference. The
 * reference is joined verbatim: dedenting it would flatten its indented code examples.
 */
const SYSTEM_PROMPT = [
  behavior.trim(),
  EXTERNAL_TOOL_GUIDANCE,
  DESIGN_WORKFLOW,
  JSX_REFERENCE
].join('\n\n')

export default SYSTEM_PROMPT
