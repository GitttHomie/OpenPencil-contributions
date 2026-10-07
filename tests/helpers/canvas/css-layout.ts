import type { Page } from '@playwright/test'

import { colorToCSS } from '@open-pencil/scene-graph/color'

import type * as AutomationFactory from '@/app/automation/bridge/figma-factory'
import type * as AutomationHandlers from '@/app/automation/bridge/handlers'

export async function renderCSSLayout(page: Page) {
  const shadow = `0 8px 16px 2px ${colorToCSS({ r: 0, g: 0, b: 0, a: 0.3 })}, inset 0 2px 0 #fff`
  return page.evaluate(async (shadow) => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('Editor unavailable')
    const handlersPath = '/src/app/automation/bridge/handlers.ts'
    const factoryPath = '/src/app/automation/bridge/figma-factory.ts'
    const { createAutomationCommandHandlers } = (await import(
      handlersPath
    )) as typeof AutomationHandlers
    const { makeFigmaFromStore } = (await import(factoryPath)) as typeof AutomationFactory
    const { handleRequest } = createAutomationCommandHandlers(makeFigmaFromStore)
    const days = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']
    const labels = days.map(
      (day) => `<Text name="${day}" w="fill" size={14} color="#172554">${day}</Text>`
    )
    const cells = Array.from(
      { length: 14 },
      (_, index) => `<Frame name="cell${index}" w={28} h={28} rounded={6} bg="#3B82F6" />`
    )
    await handleRequest(store, 'tool', {
      name: 'render',
      args: {
        jsx: `<Frame name="Calendar" x={40} y={40} w={340} h={220} bg="#EFF6FF" rounded={16} shadow="${shadow}">
          <Frame name="Week" x={30} y={30} flex="row" gap={4} w={280} h={24}>${labels.join('')}</Frame>
          <Frame name="Days" x={30} y={70} grid columns="repeat(7, minmax(0, 1fr))" gap={4} w={280}>${cells.join('')}</Frame>
        </Frame>`
      }
    })
    store.clearSelection()
    store.requestRender()
    return days.map((name) => {
      const node = [...store.graph.nodes.values()].find((node) => node.name === name)
      if (!node) throw new Error(`Missing label ${name}`)
      return { x: node.x, width: node.width }
    })
  }, shadow)
}
