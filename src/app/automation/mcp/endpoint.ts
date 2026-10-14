import { AUTOMATION_HTTP_PORT } from '@open-pencil/core/constants'

export const IS_NATIVE_TEST = import.meta.env.MODE === 'native-test'
const NATIVE_TEST_MCP_PORT = 17600

/** Native acceptance tests must never attach to the installed app's server. */
function localAutomationURL(): string {
  if (IS_NATIVE_TEST) return `http://127.0.0.1:${NATIVE_TEST_MCP_PORT}`
  if (import.meta.env.DEV && typeof __OPENPENCIL_LOCAL_AUTOMATION_HTTP_URL__ === 'string')
    return __OPENPENCIL_LOCAL_AUTOMATION_HTTP_URL__
  return `http://127.0.0.1:${AUTOMATION_HTTP_PORT}`
}

export const LOCAL_AUTOMATION_HTTP_URL = localAutomationURL()

export function getMCPServerURL(): string {
  return `${LOCAL_AUTOMATION_HTTP_URL}/mcp`
}

export function getAutomationWebSocketURL(): string {
  return LOCAL_AUTOMATION_HTTP_URL.replace(/^http/, 'ws')
}

export function getLocalMCPPort(): number {
  return Number(new URL(LOCAL_AUTOMATION_HTTP_URL).port) || AUTOMATION_HTTP_PORT
}
