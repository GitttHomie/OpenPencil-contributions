import blender from './blender-guidance.md?raw'
import externalTools from './external-tools.md?raw'

/** Shared by API/harness chat and repeated on subsequent ACP turns. */
const EXTERNAL_TOOL_GUIDANCE = [externalTools.trim(), blender.trim()].join('\n\n')

export default EXTERNAL_TOOL_GUIDANCE
