import { expect, test } from 'bun:test'

import { expectDefined } from '#core-tests/helpers/assert'
import { createSavedActionCell } from '#core-tests/helpers/fig/action-cell'

import { FigmaAPI, type FigmaInstanceNode } from '#core/figma-api'
import { setInstanceProperties } from '#core/tools/component-properties'

test.each(['api', 'tool'] as const)(
  '%s visibility assignments match inspector layout before the next geometry read',
  (path) => {
    const { editor, graph, main, action, list } = createSavedActionCell()
    try {
      const api = new FigmaAPI(graph)
      const row = expectDefined(graph.createInstance(main.id, list.id))
      const proxy = expectDefined(api.getNodeById(row.id))
      if (proxy.type !== 'INSTANCE') throw new Error('Expected instance proxy')
      if (path === 'api')
        (proxy as FigmaInstanceNode).setProperties({ 'Show action#show-action': false })
      else setInstanceProperties.execute(api, { id: row.id, values: { 'show-action': false } })
      expect(proxy.height).toBe(68)
      expect(list.height).toBe(68)
      expect(row.componentPropertyAssignments['show-action']).toBe('false')
      expect(action.visible).toBe(true)
      expect(main.height).toBe(94)
    } finally {
      editor.dispose()
    }
  }
)
