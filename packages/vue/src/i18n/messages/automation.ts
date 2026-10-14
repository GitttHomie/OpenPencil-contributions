import { params } from '@nanostores/i18n'

import { i18n } from '#vue/i18n/create'

export const automationMessageDefaults = {
  toolAccessDescription:
    'Configure design tools independently for built-in AI and the local MCP server.',
  toolAccessTarget: 'Configure tool access for',
  builtInAI: 'Built-in AI',
  localMCP: 'Local MCP',
  restoreToolDefaults: 'Restore defaults',
  aiToolAccessDescription:
    'Choose tools for direct AI model connections. ACP and Pi agents use MCP access instead.',
  mcpToolAccessDescription:
    'Choose tools advertised by the local server to connected agents and clients.',
  aiToolsNotice:
    'Changes apply to your next message. Tool switches are not a sandbox: enabled script tools can still perform other design operations.',
  mcpFailureNotInstalled: 'The bundled canvas helper is missing',
  mcpFailureNotInstalledHint:
    'Reinstall the complete OpenPencil application. Its canvas helper is included; no separate runtime or package installation is needed.',
  mcpFailureOutdated: 'MCP server does not match this version of OpenPencil',
  mcpFailureOutdatedHint: params(
    'The installed MCP server is {running}, and this version of OpenPencil needs {version}. The server is installed separately to keep the download small, so it does not update with the app.'
  ),
  mcpInstallByHand: 'Install it from a terminal, or copy a prompt that asks your agent to do it.',
  mcpCopyAgentPrompt: 'Copy prompt for your agent',
  mcpUpdating: 'Updating…',
  mcpFailurePermission: 'OpenPencil cannot start the MCP server',
  mcpFailurePermissionHint:
    'The system denied the bundled helper. Reinstall the complete OpenPencil application and try again.',
  mcpFailureExited: 'MCP server stopped during startup',
  mcpFailureExitedHint: 'The process exited before it became ready.',
  mcpFailureTimeout: 'MCP server did not respond in time',
  mcpFailureTimeoutHint: 'It did not become ready within the startup timeout.',
  mcpFailureRejected: 'MCP server rejected the local connection',
  mcpFailureRejectedHint: 'Restart the MCP server to issue a new token.',
  mcpFailureMalformed: 'MCP server returned an unexpected response',
  mcpFailureMalformedHint:
    'Restart OpenPencil to use the canvas helper included with this application.',
  mcpFailureUnreachable: 'MCP server is not reachable',
  mcpFailureUnreachableHint: params(
    'Nothing is listening at {endpoint}. Check that the address is free, then start the server.'
  ),
  mcpFailureUnknown: 'MCP server could not start',
  mcpFailureUnknownHint: 'Start it again, or check the diagnostic details below.',
  mcpFailureDetails: 'Details',
  mcpFailureCopy: 'Copy details',
  localServer: 'Local server',
  localServerDesktopOnly:
    'The local MCP server runs with the OpenPencil desktop app. In the browser, use WebMCP below.',
  webmcpDescription:
    'Let browser agents use this document directly, without a local MCP server or bearer token. Local server settings do not apply here.',
  browserAccess: 'Browser agent access',
  accessOff: 'Off',
  accessInspect: 'Inspect',
  accessEdit: 'Edit',
  accessOffDescription: 'No tools are exposed to browser agents.',
  accessInspectDescription: 'Agents can inspect the document but cannot change it.',
  accessEditDescription:
    'Agents can also edit existing properties, text, and variable values. Edits are undoable; creating or deleting content, scripts, and file access are excluded.',
  webmcpFailed: 'WebMCP could not start',
  webmcpUnsupported:
    'This browser does not expose WebMCP. Use a supported Chrome version and enable WebMCP testing, then relaunch the browser.',
  noMatchingTools: 'No tools match your search.',
  connections: 'MCP connections',
  connectionsDescription: 'Connect tools and services, then enable them for individual chats.',
  addConnection: 'Add connection',
  addServerConnection: 'Add MCP connection',
  editConnection: 'Edit MCP connection',
  connectionEditorDescription: 'Configure a local MCP command or an HTTP server.',
  connectionName: 'Connection name',
  connectionNameHint: 'Use a unique name, up to 80 characters. The name open-pencil is reserved.',
  connectionNameInvalid: 'Choose a unique name of at most 80 characters, other than open-pencil.',
  serverURLHint:
    'Use HTTPS. HTTP is allowed only for localhost or a loopback address. Do not include credentials in the URL.',
  serverURL: 'MCP server URL',
  enableConnection: 'Available in chats',
  bearerAuthentication: 'Use bearer authentication',
  bearerToken: 'Bearer token',
  bearerTokenPlaceholder: 'Enter bearer token',
  bearerTokenRequired: 'Enter a bearer token before enabling this connection.',
  deleteConnection: 'Delete connection',
  deleteConnectionDescription: 'Delete this MCP connection and remove its saved bearer token?',
  noConnections: 'No external MCP connections configured.',
  description: 'Monitor and restart the local MCP server used by agents and automation.',
  status: 'Status',
  port: 'Port',
  address: 'Address',
  version: 'Version',
  authentication: 'Require authentication',
  authenticationDescription:
    'Protect the localhost MCP endpoint with a bearer token. Disable only on a trusted machine. Restart the server to apply changes.',
  selectionScope: 'Share only the selection',
  selectionScopeDescription:
    'Let MCP clients read only the layers you select, with get_selection, get_node, get_page_tree, describe, and export_image, and no other tools. Restart the server to apply changes.',
  rootDirectory: 'MCP root directory',
  rootDirectoryDefault: 'Server default directory',
  chooseRootDirectory: 'Choose folder',
  useDefaultRoot: 'Use default',
  rootDirectoryDescription:
    'File tools are limited to this folder. Restart the MCP server to apply changes.',
  tools: 'Available tools',
  toolsEnabled: params('{enabled} of {total} enabled'),
  enableAllTools: 'Enable all',
  searchTools: 'Search tools',
  readOnlyTools: 'Read-only tools',
  sideEffectTools: 'Tools with side effects',
  toolsRestartNotice:
    'Restart the MCP server, then reconnect stdio clients, to apply tool availability changes.',
  externalRestartNotice:
    'This server is managed by another process. Restart that process to apply changes.',
  restart: 'Restart MCP server',
  externallyManaged: 'Managed externally',
  starting: 'Starting…',
  statusIdle: 'Not initialized',
  statusStarting: 'Starting',
  statusRunning: 'Running',
  statusStopped: 'Stopped',
  statusError: 'Error',
  imageSaveFailed: 'Could not save the image. Try again.',
  rememberedCanvasApprovals: 'Remembered canvas approvals',
  rememberedCanvasApprovalsHint:
    'Kiro’s “Always allow” remembers that OpenPencil tool across chats and app restarts. Reset to ask again in new chats; running agents may keep their own approvals until closed.',
  resetCanvasApprovals: 'Reset approvals',
  mcpFailureCopied: 'Diagnostic details copied.',
  webmcpSetup: 'WebMCP setup guide',
  localCommand: 'Local command',
  httpServer: 'HTTP server',
  transportType: 'Connection type',
  command: 'Executable',
  arguments: 'Arguments (one per line)',
  environment: 'Environment (JSON)',
  environmentHint:
    'Leave blank to keep the saved environment. Enter {} to clear its values. Stored securely.',
  approvalList: 'Auto-approved API tools (one exact name per line)',
  importConfiguration: 'Import MCP configuration',
  configurationJSON: 'MCP configuration JSON',
  importHint:
    'Paste an mcpServers object or named server entries from your IDE. Import saves connections; it does not run them.',
  importFailed:
    'Could not import the configuration. Check names and values. Any partially saved connection remains disabled.',
  testConnection: 'Test connection',
  connectionReady: 'Connected — available tools',
  chatConnections: 'Tools for this chat',
  noChatConnections: 'Add connections in Settings → MCP.',
  placeImage: 'Place image on canvas',
  imagePlacementFailed: 'Could not place this image on the canvas.'
} as const

export const automationMessages = i18n('automation', automationMessageDefaults)
