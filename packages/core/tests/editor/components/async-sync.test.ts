import { expect, spyOn, test } from 'bun:test'

import { expectDefined } from '#core-tests/helpers/assert'

import { createComponentSyncScheduler } from '#core/editor/component-sync'
import { createEditor } from '#core/editor/create'
import { FigmaAPI } from '#core/figma-api/index'
import { render } from '#core/tools/create/render'

test('async render synchronizes a complete component once before returning', async () => {
  const editor = createEditor()
  const figma = new FigmaAPI(editor.graph)
  const component = editor.graph.createNode('COMPONENT', editor.state.currentPageId, {
    layoutMode: 'VERTICAL',
    primaryAxisSizing: 'HUG',
    counterAxisSizing: 'FIXED',
    width: 120
  })
  const instance = expectDefined(
    editor.graph.createInstance(component.id, editor.state.currentPageId)
  )
  await Promise.resolve()
  const sync = spyOn(editor.graph, 'syncInstancesTogether')
  try {
    await editor.runMutationWithLayout(
      () =>
        render.execute(figma, {
          parent_id: component.id,
          jsx: `<>
            <Frame name="First" w={120} h={20} />
            <Frame name="Second" w={120} h={30} />
            <Frame name="Third" w={120} h={40} />
          </>`
        }),
      component.id
    )
    expect(sync).toHaveBeenCalledTimes(1)
    expect(editor.graph.getChildren(instance.id).map((node) => node.name)).toEqual([
      'First',
      'Second',
      'Third'
    ])
    expect(component.height).toBe(90)
    expect(instance.height).toBe(90)
    expect(editor.graph.getChildren(instance.id).map((node) => node.y)).toEqual([0, 20, 50])
  } finally {
    sync.mockRestore()
    editor.dispose()
  }
})

test('nested mutations return with updated instances and rejection releases batching', async () => {
  const editor = createEditor()
  const component = editor.graph.createNode('COMPONENT', editor.state.currentPageId)
  const instance = expectDefined(
    editor.graph.createInstance(component.id, editor.state.currentPageId)
  )
  await Promise.resolve()
  const sync = spyOn(editor.graph, 'syncInstancesTogether')
  try {
    await expect(
      editor.runMutationWithLayout(async () => {
        editor.graph.updateNode(component.id, { opacity: 0.5 })
        await editor.runMutationWithLayout(() => {
          editor.graph.updateNode(component.id, { name: 'Updated' })
        })
        expect(sync).toHaveBeenCalledTimes(1)
        expect(instance.opacity).toBe(0.5)
        throw new Error('Interrupted')
      })
    ).rejects.toThrow('Interrupted')
    expect(sync).toHaveBeenCalledTimes(1)
    expect(instance.opacity).toBe(0.5)
    editor.graph.updateNode(component.id, { opacity: 0.8 })
    await Promise.resolve()
    expect(sync).toHaveBeenCalledTimes(2)
    expect(instance.opacity).toBe(0.8)
  } finally {
    sync.mockRestore()
    editor.dispose()
  }
})

test('an overlapping mutation updates its instances without waiting for another operation', async () => {
  const editor = createEditor()
  const component = editor.graph.createNode('COMPONENT', editor.state.currentPageId)
  const instance = expectDefined(
    editor.graph.createInstance(component.id, editor.state.currentPageId)
  )
  await Promise.resolve()
  let resume: (() => void) | undefined
  const paused = new Promise<void>((resolve) => {
    resume = resolve
  })
  const first = editor.runMutationWithLayout(async () => {
    editor.graph.updateNode(component.id, { opacity: 0.5 })
    await paused
    editor.graph.updateNode(component.id, { opacity: 0.8 })
  })
  try {
    await editor.runMutationWithLayout(() => {
      editor.graph.updateNode(component.id, { width: 240 })
    })
    expect(instance.width).toBe(240)
    expect(instance.opacity).toBe(0.5)
    resume?.()
    await first
    expect(instance.width).toBe(240)
    expect(instance.opacity).toBe(0.8)
  } finally {
    resume?.()
    await first
    editor.dispose()
  }
})

test('cancellation drops pending work and an old batch cannot hold up a new one', async () => {
  const editor = createEditor()
  const component = editor.graph.createNode('COMPONENT', editor.state.currentPageId)
  await Promise.resolve()
  const scheduler = createComponentSyncScheduler(
    () => editor.graph,
    () => undefined
  )
  const sync = spyOn(editor.graph, 'syncInstancesTogether')
  let resume: (() => void) | undefined
  const paused = new Promise<void>((resolve) => {
    resume = resolve
  })
  try {
    const oldBatch = scheduler.runWithComponentSync(async () => {
      scheduler.scheduleComponentSync(component.id)
      await paused
    })
    scheduler.cancelComponentSync()
    await scheduler.runWithComponentSync(() => {
      scheduler.scheduleComponentSync(component.id)
    })
    expect(sync).toHaveBeenCalledTimes(1)
    resume?.()
    await oldBatch
    expect(sync).toHaveBeenCalledTimes(1)
    scheduler.scheduleComponentSync(component.id)
    scheduler.cancelComponentSync()
    await Promise.resolve()
    expect(sync).toHaveBeenCalledTimes(1)
  } finally {
    resume?.()
    sync.mockRestore()
    editor.dispose()
  }
})
