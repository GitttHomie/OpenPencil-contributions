import * as v from 'valibot'

import { defineTool } from '#core/tools/schema'

import creation from './creation.md?raw'
import designSystem from './design-system.md?raw'
import review from './review.md?raw'
import ux from './ux.md?raw'
import visual from './visual.md?raw'
import workflow from './workflow.md?raw'

export const DESIGN_WORKFLOW = workflow.trim()

const topics = {
  ux: { description: 'User tasks, flows, states, content, and accessibility intent.', content: ux },
  visual: {
    description: 'Visual direction, typography, composition, and imagery.',
    content: visual
  },
  'design-system': {
    description: 'Real variable bindings, reusable components, instances, and layout.',
    content: designSystem
  },
  review: {
    description: 'Evidence-based visual, UX, and document-structure assessment.',
    content: review
  },
  creation: {
    description:
      'Creation tool routes for component properties, slots, paint stacks, gradients, layout and bindings.',
    content: creation
  }
}

export const getDesignGuidance = defineTool({
  name: 'get_design_guidance',
  description:
    'Read bundled OpenPencil design skills. Choose relevant topics for substantial design or review work; omit topics for the workflow and topic catalog. Briefs and PRDs are optional. Does not modify the document.',
  execution: { kind: 'sync', mutation: 'none' },
  capabilities: [],
  input: v.object({
    topics: v.optional(
      v.pipe(
        v.array(v.picklist(['ux', 'visual', 'design-system', 'review', 'creation'])),
        v.maxLength(5),
        v.description('Load only the topics needed for this task.')
      ),
      []
    )
  }),
  execute: (_figma, args) => ({
    version: '1.1.0',
    workflow: DESIGN_WORKFLOW,
    available: Object.entries(topics).map(([topic, { description }]) => ({ topic, description })),
    guidance: [...new Set(args.topics)].map((topic) => ({
      topic,
      content: topics[topic].content.trim()
    }))
  })
})
