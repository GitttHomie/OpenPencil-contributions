import type { createAIModelRuntime } from '@/app/ai/models'
import type { InspectionDependencies } from '@/app/ai/vision/inspect'

export type VisionModelDependencies = InspectionDependencies & {
  createRuntime: typeof createAIModelRuntime
}
