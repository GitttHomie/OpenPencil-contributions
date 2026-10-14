import { enabledMCPConnections } from './store'

export function selectedMCPConnections(ids: readonly string[]) {
  return enabledMCPConnections.value.filter((connection) => ids.includes(connection.id))
}
