import type { SceneNode } from '../'
import { TEXT_SHAPING_FIELDS } from '../fields/text'

export const INSTANCE_SYNC_TEXT_PROPS = [
  'name',
  ...TEXT_SHAPING_FIELDS,
  'textAutoResize',
  'textLanguage',
  'maxLines',
  'textTruncation',
  'leadingTrim',
  'textDecoration',
  'textDecorationStyle',
  'textDecorationThickness',
  'textDecorationFills',
  'textDecorationSkipInk',
  'textUnderlineOffset'
] as const

/** Fields that belong to another one: overriding the owner keeps them too. */
export const INSTANCE_SYNC_FIELD_OWNERS: Readonly<Partial<Record<string, string>>> = {
  styleRuns: 'text',
  textParagraphs: 'text'
}

export const INSTANCE_SYNC_PROPS: (keyof SceneNode)[] = [
  'width',
  'height',
  'minWidth',
  'maxWidth',
  'minHeight',
  'maxHeight',
  'targetAspectRatio',
  'fills',
  'strokes',
  'strokeWeight',
  'strokeAlign',
  'effects',
  'opacity',
  'cornerRadius',
  'cornerSmoothing',
  'topLeftRadius',
  'topRightRadius',
  'bottomRightRadius',
  'bottomLeftRadius',
  'independentCorners',
  'layoutMode',
  'layoutDirection',
  'layoutWrap',
  'primaryAxisAlign',
  'counterAxisAlign',
  'primaryAxisSizing',
  'counterAxisSizing',
  'itemSpacing',
  'counterAxisSpacing',
  'paddingTop',
  'paddingRight',
  'paddingBottom',
  'paddingLeft',
  'gridTemplateColumns',
  'gridTemplateRows',
  'gridColumnGap',
  'gridRowGap',
  'gridPosition',
  'clipsContent',
  'itemReverseZIndex',
  'strokesIncludedInLayout',
  'layoutGrids',
  'blendMode',
  'strokeCap',
  'strokeJoin',
  'strokeMiterLimit',
  'dashPattern',
  'independentStrokeWeights',
  'borderTopWeight',
  'borderRightWeight',
  'borderBottomWeight',
  'borderLeftWeight',
  'boundVariables',
  'variableModes',
  // Applied shared styles follow the component unless an instance overrides them.
  'fillStyleId',
  'strokeStyleId',
  'textStyleId',
  'effectStyleId',
  'gridStyleId'
]

/** How a layer inside an instance sits in its parent and whether it is locked, which its overrides may change. */
export const INSTANCE_SYNC_CHILD_PROPS = ['layoutGrow', 'layoutAlignSelf', 'locked'] as const

/**
 * Where a component's layer sits and how it is shaped, which Figma refuses to override in an
 * instance ("This property cannot be overridden in an instance"), so its copies always follow.
 * A layer in an auto layout flow takes its position from the layout instead.
 */
export const INSTANCE_FOLLOWED_FIELDS = [
  'rotation',
  'flipX',
  'flipY',
  'horizontalConstraint',
  'verticalConstraint',
  'layoutPositioning',
  'counterAxisAlignContent',
  'isMask',
  'maskType',
  'arcData',
  'pointCount',
  'starInnerRadius'
] as const

/** Fields an edit to a layer inside an instance records as that instance's override. */
export const INSTANCE_OVERRIDE_FIELDS = [
  'x',
  'y',
  ...INSTANCE_SYNC_PROPS,
  ...INSTANCE_SYNC_TEXT_PROPS,
  ...INSTANCE_SYNC_CHILD_PROPS,
  'visible'
] as const

/** Fields a component's layer gives the copies of it in every instance. */
export const INSTANCE_SYNC_FIELDS = [
  ...INSTANCE_OVERRIDE_FIELDS,
  ...INSTANCE_FOLLOWED_FIELDS
] as const
