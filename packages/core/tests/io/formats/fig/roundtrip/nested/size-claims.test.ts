import { expect, test } from 'bun:test'

import { expectDefined } from '#core-tests/helpers/assert'

import { initCodec, parseFigFile } from '@open-pencil/core'
import { setInstanceOverride } from '@open-pencil/scene-graph'

import { createEditor } from '#core/editor/create'
import { exportFigFile } from '#core/io/formats/fig/export'

async function savedSizeClaims(width: number) {
  const editor = createEditor()
  try {
    const graph = editor.graph
    const page = editor.state.currentPageId
    const set = graph.createNode('COMPONENT_SET', page, {
      name: 'Icon',
      componentPropertyDefinitions: [
        {
          id: 'size',
          name: 'Size',
          type: 'VARIANT',
          defaultValue: 'Small',
          variantOptions: ['Small', 'Medium', 'Large']
        }
      ]
    })
    const variants = [24, 32, 48].map((size, index) =>
      graph.createNode('COMPONENT', set.id, {
        name: `Size=${['Small', 'Medium', 'Large'][index]}`,
        componentPropertyValues: { Size: ['Small', 'Medium', 'Large'][index] },
        width: size,
        height: size
      })
    )
    const small = expectDefined(variants[0])
    const medium = expectDefined(variants[1])
    const layout = {
      layoutMode: 'HORIZONTAL',
      primaryAxisSizing: 'HUG',
      counterAxisSizing: 'HUG'
    } as const
    const parent = graph.createNode('COMPONENT', page, { name: 'Button', ...layout })
    const wrapper = graph.createNode('FRAME', parent.id, layout)
    const source = expectDefined(graph.createInstance(small.id, wrapper.id, { name: 'Icon' }))
    for (const axis of ['width', 'height'])
      setInstanceOverride(source.instanceOverrides, source.id, source.id, axis, 24)
    editor.setNestedComponentPropertyExposure(parent.id, source.id, ['size'])
    const instance = expectDefined(
      graph.createInstance(parent.id, page, { name: 'Button instance' })
    )
    await Promise.resolve()
    const nested = expectDefined(
      graph.getChildren(expectDefined(graph.getChildren(instance.id)[0]).id)[0]
    )
    // A legacy saved swap retained the original source dimensions in both owners.
    setInstanceOverride(
      instance.instanceOverrides,
      instance.id,
      nested.id,
      'sourceComponentId',
      source.id
    )
    setInstanceOverride(
      instance.instanceOverrides,
      instance.id,
      nested.id,
      'componentId',
      medium.id
    )
    for (const axis of ['width', 'height']) {
      const value = axis === 'width' ? width : 24
      setInstanceOverride(instance.instanceOverrides, instance.id, nested.id, axis, value)
      setInstanceOverride(nested.instanceOverrides, nested.id, nested.id, axis, value)
    }
    setInstanceOverride(nested.instanceOverrides, nested.id, nested.id, 'opacity', 0.5)
    graph.updateNode(nested.id, { componentId: medium.id, width, height: 24, opacity: 0.5 })
    return await exportFigFile(graph)
  } finally {
    editor.dispose()
  }
}

for (const width of [24, 120]) {
  for (const forwarded of [false, true]) {
    test(`saved source-size claims do not pin nested variants (${forwarded ? 'forwarded' : 'direct'}, ${width === 24 ? 'inherited' : 'custom'} width)`, async () => {
      await initCodec()
      const bytes = await savedSizeClaims(width)
      const graph = await parseFigFile(bytes.slice().buffer)
      const editor = createEditor({ graph })
      let reopened: ReturnType<typeof createEditor> | undefined
      try {
        const parent = expectDefined(
          [...graph.getAllNodes()].find((node) => node.name === 'Button instance')
        )
        const control = expectDefined(
          editor
            .getInstanceComponentPropertyDefinitions(parent.id)
            .find((item) => item.type === 'VARIANT')
        )
        const nested = expectDefined(
          editor.getInstanceComponentPropertyTarget(parent.id, control.id)
        ).instance
        const direct = expectDefined(
          editor
            .getInstanceComponentPropertyDefinitions(nested.id)
            .find((item) => item.type === 'VARIANT')
        )
        const beforeOverrides = structuredClone(parent.instanceOverrides)
        expect(nested).toMatchObject({ width, height: 24, opacity: 0.5 })
        editor.setInstanceComponentProperty(
          forwarded ? parent.id : nested.id,
          forwarded ? control.id : direct.id,
          'Large'
        )
        await Promise.resolve()
        expect(nested).toMatchObject({ width: width === 24 ? 48 : width, height: 48, opacity: 0.5 })
        expect(parent).toMatchObject({ width: width === 24 ? 48 : width, height: 48 })
        editor.undoAction()
        expect(nested).toMatchObject({ width, height: 24, opacity: 0.5 })
        expect(parent.instanceOverrides).toEqual(beforeOverrides)
        editor.redoAction()
        expect(nested).toMatchObject({ width: width === 24 ? 48 : width, height: 48 })
        const saved = await exportFigFile(graph)
        const restored = await parseFigFile(saved.slice().buffer)
        reopened = createEditor({ graph: restored })
        const restoredParent = expectDefined(
          [...restored.getAllNodes()].find((node) => node.name === 'Button instance')
        )
        const restoredControl = expectDefined(
          reopened
            .getInstanceComponentPropertyDefinitions(restoredParent.id)
            .find((item) => item.type === 'VARIANT')
        )
        const restoredIcon = expectDefined(
          reopened.getInstanceComponentPropertyTarget(restoredParent.id, restoredControl.id)
        ).instance
        expect(restoredIcon).toMatchObject({
          width: width === 24 ? 48 : width,
          height: 48,
          opacity: 0.5
        })
        reopened.setInstanceComponentProperty(restoredParent.id, restoredControl.id, 'Medium')
        await Promise.resolve()
        expect(restoredIcon).toMatchObject({
          width: width === 24 ? 32 : width,
          height: 32,
          opacity: 0.5
        })
        expect(restoredParent).toMatchObject({ width: width === 24 ? 32 : width, height: 32 })
      } finally {
        reopened?.dispose()
        editor.dispose()
      }
    })
  }
}
