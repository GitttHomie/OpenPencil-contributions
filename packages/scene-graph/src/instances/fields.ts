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

export const INSTANCE_SYNC_PROPS: (keyof SceneNode)[] = [
  'width',
  'height',
  'minWidth',
  'maxWidth',
  'minHeight',
  'maxHeight',
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

export const INSTANCE_SYNC_FIELDS = [
  ...INSTANCE_SYNC_PROPS,
  ...INSTANCE_SYNC_TEXT_PROPS,
  // Descendant placement follows the definition; an instance root's placement
  // belongs to its own parent and is deliberately absent from INSTANCE_SYNC_PROPS.
  'x',
  'y',
  'layoutPositioning',
  'layoutGrow',
  'layoutAlignSelf',
  'horizontalConstraint',
  'verticalConstraint',
  'visible'
] as const
