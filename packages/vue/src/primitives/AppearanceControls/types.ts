import type { VNode } from 'vue'

import type { BlendMode, SceneNode } from '@open-pencil/scene-graph'

import type { CornerGeometryKey, CornerRadiusKey } from '#vue/controls/appearance/types'
import type { MixedValue } from '#vue/controls/node-props/use'

export interface AppearanceControlsActions {
  updateProp(key: string, value: number): void
  commitProp(key: string, value: number, previous: number): void
  setBlendMode(value: BlendMode): void
  toggleVisibility(): void
  toggleIndependentCorners(): void
  updateUniformRadius(value: number): void
  commitUniformRadius(): void
  updateCornerProp(key: CornerGeometryKey, value: number): void
  commitCornerProp(key: CornerGeometryKey, value: number, previous: number): void
}

export interface AppearanceControlsRootSlotProps {
  node: SceneNode | null
  nodes: SceneNode[]
  isMulti: boolean
  active: boolean
  hasCornerRadius: boolean
  independentCorners: MixedValue<boolean>
  showIndependentCorners: boolean
  cornerRadiusValue: MixedValue<number>
  cornerRadiusBindingPaths: Array<CornerRadiusKey | 'cornerRadius'>
  cornerSmoothingPercent: MixedValue<number>
  opacityPercent: MixedValue<number>
  blendModeValue: MixedValue<BlendMode>
  visibilityState: 'visible' | 'hidden' | 'mixed'
  /** True when any selected layer's visibility is controlled by a component property. */
  visibilityLinked: boolean
  /** Names of the component properties controlling the selected layers' visibility. */
  visibilityPropertyNames: string[]
  actions: AppearanceControlsActions
}

export interface AppearanceControlsRootSlots {
  /** Complete selection-derived appearance state and mutation actions. */
  default(props: AppearanceControlsRootSlotProps): VNode[]
}
