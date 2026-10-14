import {
  cleanFigFileOnOpen,
  parseFigFile,
  readFigFile,
  findFigThumbnailPageId,
  populateFigPage,
  type FigCleanupResult
} from '@open-pencil/core/io/formats/fig'
import { computeAllLayouts } from '@open-pencil/core/layout'
import type { SceneGraph } from '@open-pencil/scene-graph'

import { requestFigCleanup } from './cleanup-prompt'

const cleanedDocuments = new WeakSet<SceneGraph>()

export const wasFigCleanedOnOpen = (graph: SceneGraph) => cleanedDocuments.has(graph)

export async function readFigDocument(file: File, signal?: AbortSignal, offerCleanup = false) {
  const options = { populate: 'first-page', signal } as const
  // Recovery and file-watcher reloads must never interrupt the user with import questions.
  if (!offerCleanup) return readFigFile(file, options)
  const original = await file.arrayBuffer()
  signal?.throwIfAborted()
  const cleanupAbort = new AbortController()
  const abort = () => cleanupAbort.abort()
  signal?.addEventListener('abort', abort, { once: true })
  let result: FigCleanupResult
  const decision = { accepted: false }
  try {
    result = await cleanFigFileOnOpen(
      original,
      async (summary) => {
        const choice = await requestFigCleanup(file.name, summary, cleanupAbort.signal)
        decision.accepted = choice !== 'keep'
        return choice
      },
      cleanupAbort.signal
    )
  } catch (error) {
    signal?.throwIfAborted()
    // A requested cleanup that fails must surface through the import error UI.
    if (decision.accepted) throw error
    console.warn('Embedded component cleanup unavailable; preserving the original file.', error)
    result = { bytes: original, cleaned: false }
  } finally {
    // A worker failure while asking must not leave an orphan dialog blocking later imports.
    cleanupAbort.abort()
    signal?.removeEventListener('abort', abort)
  }
  const graph = await parseFigFile(result.bytes, options)
  if (result.cleaned) cleanedDocuments.add(graph)
  return graph
}

export async function readFigForTab(
  file: File,
  signal?: AbortSignal,
  offerCleanup = false
): Promise<SceneGraph> {
  const imported = await readFigDocument(file, signal, offerCleanup)
  const firstPageId = imported.getPages()[0]?.id
  const layOut = (pageId: string) =>
    imported.applyDerivedLayoutDuring(() => computeAllLayouts(imported, pageId))
  if (firstPageId) layOut(firstPageId)
  const coverPageId = findFigThumbnailPageId(imported.getPages())
  if (coverPageId && coverPageId !== firstPageId) {
    populateFigPage(imported, coverPageId)
    layOut(coverPageId)
  }
  return imported
}
