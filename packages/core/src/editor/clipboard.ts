import { CommittedGraphEventError } from '@open-pencil/scene-graph'
import type { SceneNode } from '@open-pencil/scene-graph'
import type { Vector } from '@open-pencil/scene-graph/primitives'

import { parseFigmaClipboard, parseOpenPencilClipboard } from '#core/clipboard'
import { prepareClipboardImport } from '#core/clipboard/fig-import'
import { computeAllLayouts } from '#core/layout'

import { createClipboardAssetActions } from './clipboard/assets'
import { createPastedTrees } from './clipboard/component-paste'
import type { ClipboardSnapshot } from './clipboard/copy'
import { createClipboardCopyActions } from './clipboard/copy'
import { deleteSelected } from './clipboard/delete'
import { importClipboardDependencies } from './clipboard/dependencies'
import { createClipboardExportActions } from './clipboard/export'
import { createClipboardFontActions } from './clipboard/fonts'
import { deleteIds, recreateSnapshots } from './clipboard/history'
import type { PasteHistoryOperation } from './clipboard/paste-replace'
import { replaceTargetsWithCreated, selectedReplacementTargets } from './clipboard/paste-replace'
import { resolvePasteTarget } from './clipboard/paste-target'
import { createClipboardPlacementActions } from './clipboard/placement'
import { collectSubtrees, restoreSubtree, snapshotSubtree } from './clipboard/subtree-history'
import type { EditorContext } from './types'

type PasteOptions = {
  replaceSelection?: boolean
}

export function createClipboardActions(ctx: EditorContext) {
  function duplicateSelected(selectedNodes: SceneNode[]) {
    const prevSelection = new Set(ctx.state.selectedIds)
    const selectedSet = new Set(selectedNodes.map((n) => n.id))
    const topLevel = selectedNodes.filter((n) => !n.parentId || !selectedSet.has(n.parentId))

    const newRootIds: string[] = []
    const allSnapshots = new Map<string, SceneNode>()

    for (const node of topLevel) {
      const parentId = node.parentId ?? ctx.state.currentPageId
      const clone = ctx.graph.cloneTree(node.id, parentId, {
        name: node.name + ' copy',
        x: node.x + 20,
        y: node.y + 20
      })
      if (!clone) continue
      newRootIds.push(clone.id)
      const subtree = snapshotSubtree(ctx.graph, clone.id)
      for (const [id, snap] of subtree) allSnapshots.set(id, snap)
    }

    if (newRootIds.length > 0) {
      ctx.setSelectedIds(new Set(newRootIds))
      ctx.undo.push({
        label: 'Duplicate',
        forward: () => {
          for (const rootId of newRootIds) {
            const snapshot = allSnapshots.get(rootId)
            if (!snapshot) continue
            const parentId = snapshot.parentId ?? ctx.state.currentPageId
            restoreSubtree(ctx.graph, snapshot, parentId, allSnapshots)
          }
          ctx.setSelectedIds(new Set(newRootIds))
        },
        inverse: () => {
          for (const id of newRootIds.slice().reverse()) ctx.graph.deleteNode(id)
          ctx.setSelectedIds(prevSelection)
        }
      })
    }
  }

  function pushCreatedNodesUndo(
    created: string[],
    prevSelection: Set<string>,
    label = 'Paste',
    operation?: PasteHistoryOperation
  ) {
    const allNodes = collectSubtrees(ctx.graph, created)
    const pageId = ctx.state.currentPageId
    operation?.capture()
    ctx.undo.push({
      label,
      forward: () => {
        if (operation) operation.redo()
        else recreateSnapshots(ctx, allNodes, pageId)
        computeAllLayouts(ctx.graph, pageId)
        ctx.setSelectedIds(new Set(created))
      },
      inverse: () => {
        if (operation) operation.undo()
        else deleteIds(ctx, created)
        computeAllLayouts(ctx.graph, pageId)
        ctx.setSelectedIds(prevSelection)
      }
    })
  }

  async function pasteSnapshot(
    snapshot: ClipboardSnapshot,
    cursorPos?: Vector,
    options: PasteOptions = {}
  ) {
    let created: string[] = []
    ctx.undo.runBatch('Paste', () => {
      const dependencies = importClipboardDependencies(ctx, snapshot)
      if (dependencies.styleSnapshots.length > 0) {
        ctx.undo.push({
          label: 'Import clipboard styles',
          forward: () => {
            for (const style of dependencies.styleSnapshots) {
              ctx.graph.preserveSourceMetadataDuring(() =>
                ctx.graph.createNode(style.type, ctx.state.currentPageId, style)
              )
            }
          },
          inverse: () => {
            for (const style of dependencies.styleSnapshots) ctx.graph.deleteNode(style.id)
          }
        })
      }
      if (dependencies.applyVariables && dependencies.revertVariables) {
        ctx.undo.push({
          label: 'Import clipboard variables',
          forward: dependencies.applyVariables,
          inverse: dependencies.revertVariables
        })
      }
      created = pasteOpenPencilNodes(
        dependencies.nodes,
        snapshot.images,
        dependencies.componentDependencies,
        cursorPos,
        options,
        snapshot.sourceRootId === ctx.graph.rootId
      )
    })
    await fontActions.loadFontsForNodes(created)
  }

  async function pasteFromHTML(html: string, cursorPos?: Vector, options: PasteOptions = {}) {
    const openPencil = parseOpenPencilClipboard(html)
    if (openPencil) {
      let created: string[] = []
      ctx.undo.runBatch('Paste', () => {
        created = pasteOpenPencilNodes(openPencil.nodes, openPencil.images, [], cursorPos, options)
      })
      await fontActions.loadFontsForNodes(created)
      return
    }

    const figma = await parseFigmaClipboard(html)
    if (figma) {
      const prevSelection = new Set(ctx.state.selectedIds)
      const replacementTargets = options.replaceSelection ? selectedReplacementTargets(ctx) : []
      const pasteTarget = replacementTargets[0]?.parentId ?? resolvePasteTarget(ctx)
      const operation = prepareClipboardImport(
        figma.nodes,
        ctx.graph,
        pasteTarget,
        figma.blobs,
        0,
        0,
        {
          componentsAsInstances: true
        }
      )
      let deliveryError: CommittedGraphEventError | undefined
      try {
        operation.commit()
      } catch (error) {
        if (!(error instanceof CommittedGraphEventError)) throw error
        deliveryError = error
      }
      const created = operation.plan.rootIds
      if (created.length === 0) return
      placementActions.preparePastedRoots(created)

      if (replacementTargets.length > 0) {
        replaceTargetsWithCreated(
          ctx,
          placementActions.centerNodesAt,
          created,
          replacementTargets,
          prevSelection,
          operation
        )
      } else {
        const center = placementActions.getPasteCenter(pasteTarget, cursorPos)
        placementActions.centerNodesAt(created, center.x, center.y)
        computeAllLayouts(ctx.graph, ctx.state.currentPageId)
        ctx.setSelectedIds(new Set(created))
        pushCreatedNodesUndo(created, prevSelection, 'Paste', operation)
      }

      if (deliveryError) throw deliveryError
      await Promise.all([
        hydrateFigmaClipboardImages(figma.meta.fileKey, created),
        fontActions.loadFontsForNodes(created)
      ])
      ctx.requestRender()
    }
  }

  function pasteOpenPencilNodes(
    nodes: Array<SceneNode & { children?: SceneNode[] }>,
    images: Map<string, Uint8Array>,
    dependencies: Array<SceneNode & { children?: SceneNode[] }> = [],
    cursorPos?: Vector,
    options: PasteOptions = {},
    reuseComponents = true
  ) {
    const prevSelection = new Set(ctx.state.selectedIds)
    const replacementTargets = options.replaceSelection ? selectedReplacementTargets(ctx) : []
    for (const [hash, bytes] of images) ctx.graph.images.set(hash, bytes)

    const { created, dependencyRootIds, pasteTarget, canReplace } = createPastedTrees(
      ctx.graph,
      nodes,
      dependencies,
      ctx.state.currentPageId,
      replacementTargets[0]?.parentId ?? resolvePasteTarget(ctx),
      reuseComponents,
      replacementTargets
    )
    if (dependencyRootIds.length > 0) {
      const snapshots = collectSubtrees(ctx.graph, dependencyRootIds)
      ctx.undo.push({
        label: 'Import component dependencies',
        forward: () => recreateSnapshots(ctx, snapshots, ctx.state.currentPageId),
        inverse: () => deleteIds(ctx, dependencyRootIds)
      })
    }
    if (created.length === 0) return created
    placementActions.preparePastedRoots(created)

    if (replacementTargets.length > 0 && canReplace) {
      replaceTargetsWithCreated(
        ctx,
        placementActions.centerNodesAt,
        created,
        replacementTargets,
        prevSelection
      )
      return created
    }

    if (cursorPos || pasteTarget !== ctx.state.currentPageId) {
      const center = placementActions.getPasteCenter(pasteTarget, cursorPos)
      placementActions.centerNodesAt(created, center.x, center.y)
    }
    computeAllLayouts(ctx.graph, ctx.state.currentPageId)
    ctx.setSelectedIds(new Set(created))

    pushCreatedNodesUndo(created, prevSelection)
    return created
  }

  function missingImageHashes(nodeIds: string[]) {
    const hashes = new Set<string>()
    for (const node of collectSubtrees(ctx.graph, nodeIds)) {
      for (const fill of node.fills) {
        if (fill.type === 'IMAGE' && fill.imageHash && !ctx.graph.images.has(fill.imageHash)) {
          hashes.add(fill.imageHash)
        }
      }
    }
    return [...hashes]
  }

  async function hydrateFigmaClipboardImages(fileKey: string, nodeIds: string[]) {
    const hashes = missingImageHashes(nodeIds)
    if (hashes.length === 0) return

    const resolver = ctx.resolveFigmaClipboardImages
    if (resolver) {
      try {
        const images = await resolver(fileKey, hashes)
        for (const hash of hashes) {
          const bytes = images.get(hash)
          if (bytes) ctx.graph.images.set(hash, bytes)
        }
      } catch (error) {
        console.warn('Failed to fetch Figma clipboard images', error)
      }
    }

    const missing = missingImageHashes(nodeIds).length
    if (missing > 0) {
      ctx.emitEditorEvent('clipboard:images-missing', {
        total: hashes.length,
        missing,
        fetchAttempted: Boolean(resolver)
      })
    }
  }

  function warnMissingImages(nodeIds: string[]) {
    return missingImageHashes(nodeIds).length > 0
  }

  const copyActions = createClipboardCopyActions(ctx)
  const exportActions = createClipboardExportActions(ctx)
  const fontActions = createClipboardFontActions(ctx)
  const assetActions = createClipboardAssetActions(ctx, pushCreatedNodesUndo)
  const placementActions = createClipboardPlacementActions(ctx)

  return {
    collectSubtrees,
    ...placementActions,
    ...fontActions,
    duplicateSelected,
    ...copyActions,
    pasteSnapshot,
    pasteFromHTML,
    warnMissingImages,
    deleteSelected: () => deleteSelected(ctx),
    ...assetActions,
    ...exportActions
  }
}
