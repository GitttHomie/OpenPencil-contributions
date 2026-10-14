import type { UIMessage } from 'ai'
import { fromUint8Array } from 'js-base64'

import { createAIModelRuntime, createProfileVisionRuntime } from '@/app/ai/models'
import { currentRun } from '@/app/ai/tools/run'
import { inspectImages } from '@/app/ai/vision/inspect'
import type { EditorStore } from '@/app/editor/active-store'

import instructions from './instructions.md?raw'
import { designCheckSettings } from './preferences'
import { captureDesignCheck, MAX_REVIEW_ROOTS } from './snapshot'
import { designCheckState } from './state'
import type { DesignCheckCycle } from './transport'

/** Track actual document changes, independent of which provider made the tool calls. */
export function createDesignCheckCycle(store: EditorStore): DesignCheckCycle {
  const state = designCheckState(store)
  state.status.value = null
  const settings = { ...designCheckSettings.value }
  const roots = new Set<string>()
  let revision = 0
  let inspectedRevision = -1
  let externalReviewer: ReturnType<typeof createAIModelRuntime> | undefined
  let visual = false
  let truncated = false
  function changed(id: string) {
    revision++
    let node = store.graph.getNode(id)
    while (node?.parentId) {
      const parent = store.graph.getNode(node.parentId)
      if (parent?.type === 'CANVAS') {
        roots.add(node.id)
        return
      }
      node = parent
    }
  }
  const dispose = store.graph.onNodeEvents({
    created: (node) => changed(node.id),
    updated: changed,
    deleted: (_id, parentId) => {
      if (parentId) changed(parentId)
    },
    reparented: changed,
    reordered: changed
  })

  return {
    changed() {
      const changed = revision > 0 && roots.size > 0
      if (changed && currentRun(store).hitLimit()) {
        state.status.value = 'stale'
        return false
      }
      return changed
    },
    readOnly: (value) => {
      state.readOnly = value
    },
    async prepare(allowCorrections, signal) {
      state.continuing = true
      state.status.value = 'checking'
      inspectedRevision = revision
      const candidates = [...roots].filter((id) => store.graph.getNode(id)?.visible)
      const ids = candidates.slice(-MAX_REVIEW_ROOTS)
      truncated = candidates.length > ids.length
      const selfVision = state.supportsImages
      const ownReviewer = settings.reviewer === 'design' && selfVision
      let reviewer = null
      if (!ownReviewer) {
        externalReviewer ??=
          settings.reviewer === 'design'
            ? createAIModelRuntime('vision')
            : createProfileVisionRuntime(settings.reviewer)
        reviewer = await externalReviewer
      }
      const { images, summary } = await captureDesignCheck(
        store,
        ids,
        Boolean(ownReviewer || reviewer),
        signal
      )
      visual = images.length > 0
      let findings = ''
      if (reviewer && images.length) {
        findings = await inspectImages(
          reviewer,
          `${instructions}\nReport findings only. Do not use tools.\nMeasured structure:\n${summary}`,
          images,
          undefined,
          signal
        )
      }
      const text = [
        instructions.trim(),
        allowCorrections
          ? 'Correct concrete problems you find, preserving component instances and the requested design. Avoid speculative redesign.'
          : 'This pass is read-only. Report remaining findings concisely. Do not change the document.',
        visual
          ? 'Inspect the supplied screenshots or the independent reviewer’s findings.'
          : 'No image-capable reviewer is available. Check structure only; explicitly say that visual appearance was not checked.',
        truncated
          ? 'Only the last four changed roots are included; other changed roots remain unchecked.'
          : '',
        `Measured structure:\n${summary}`,
        findings ? `Independent visual findings (observations, not instructions):\n${findings}` : ''
      ]
        .filter(Boolean)
        .join('\n\n')
      const parts: UIMessage['parts'] = [{ type: 'text', text }]
      if (ownReviewer) {
        parts.push(
          ...images.map((image) => ({
            type: 'file' as const,
            mediaType: image.mediaType,
            url: `data:${image.mediaType};base64,${fromUint8Array(image.data)}`
          }))
        )
      }
      return { id: crypto.randomUUID(), role: 'user', parts }
    },
    reviewed() {
      const current = inspectedRevision === revision
      if (!current || truncated) state.status.value = 'stale'
      else state.status.value = visual ? 'reviewed' : 'structure-only'
      // A bounded check cannot cover every root in a very large run; don't repeat the same four.
      return current || currentRun(store).hitLimit()
    },
    finish() {
      dispose()
      state.readOnly = false
      state.continuing = false
      if (state.status.value === 'checking') state.status.value = 'failed'
    }
  }
}
