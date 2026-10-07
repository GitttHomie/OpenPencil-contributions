import type { Page } from '@playwright/test'

import type * as PresenceRegistry from '@/app/presence/registry'

/** Observe displayed DOM positions separately from real targets and canvas redraws. */
export async function createAgentCursorMotionProbe(page: Page) {
  return page.evaluateHandle(async () => {
    const path = '/src/app/presence/registry.ts'
    const { addAgent, renameAgent } = (await import(path)) as typeof PresenceRegistry
    const store = window.openPencil?.getStore?.()
    if (!store?.renderer) throw new Error('Editor unavailable')
    const agent = addAgent(store, 'acp')
    renameAgent(store, agent.id, 'Fern')
    const positions: number[] = []
    let sceneFrames = 0
    let overlayFrames = 0
    let duplicatePointer = false
    const busyInterval = { start: 0, end: 0 }
    const identity = `local:agent:${agent.id}`
    const pointer = () => document.querySelector<HTMLElement>(`[data-agent-id="${identity}"]`)
    let sampleFrame = 0
    const sample = () => {
      const element = pointer()
      if (element) positions.push(new DOMMatrixReadOnly(getComputedStyle(element).transform).m41)
      sampleFrame = requestAnimationFrame(sample)
    }
    sampleFrame = requestAnimationFrame(sample)
    const cleanups = store.canvasRenderers.map((renderer) => {
      const draw = renderer.drawPresenceCursors
      const render = renderer.renderFromEditorState
      renderer.drawPresenceCursors = (...args) => {
        const cursor = args[2]?.find((entry) => entry.id === identity)
        if (cursor && cursor.pointerVisible !== false) duplicatePointer = true
        draw.apply(renderer, args)
      }
      renderer.renderFromEditorState = (...args) => {
        if (args[6] === 'scene') sceneFrames++
        if (args[6] === 'overlays') overlayFrames++
        render.apply(renderer, args)
      }
      return () => {
        renderer.drawPresenceCursors = draw
        renderer.renderFromEditorState = render
      }
    })
    return {
      move(x: number) {
        agent.update({
          status: 'editing',
          cursor: { x, y: 150, pageId: store.state.currentPageId }
        })
      },
      reset() {
        positions.length = 0
        sceneFrames = 0
        overlayFrames = 0
        duplicatePointer = false
      },
      hide() {
        agent.update({ status: 'idle' })
      },
      camera() {
        store.state.panX = 40
        store.state.panY = 30
        store.state.zoom = 2
        store.requestRepaint()
      },
      select() {
        const frame = store.graph.createNode('FRAME', store.state.currentPageId, {
          name: 'Selected by agent',
          x: 80,
          y: 100,
          width: 180,
          height: 120
        })
        agent.update({ selection: [frame.id] })
        store.requestRender()
      },
      busy() {
        // Schedule after the test has established the CSS transition. No document mutations.
        setTimeout(() => {
          busyInterval.start = Date.now()
          const until = performance.now() + 350
          while (performance.now() < until) {
            // Model a synchronous layout/import task on the UI thread.
          }
          busyInterval.end = Date.now()
        }, 0)
      },
      snapshot() {
        return {
          positions: [...positions],
          latest: positions.at(-1),
          sceneFrames,
          overlayFrames,
          duplicatePointer,
          busyInterval,
          screenX: pointer()?.getBoundingClientRect().x,
          arrowWidth: pointer()?.querySelector('svg')?.getBoundingClientRect().width,
          target: store.state.presenceCursors.find(
            (entry) => entry.id === `local:agent:${agent.id}`
          )?.x
        }
      },
      dispose() {
        cancelAnimationFrame(sampleFrame)
        agent.remove()
        for (const cleanup of cleanups) cleanup()
      }
    }
  })
}
