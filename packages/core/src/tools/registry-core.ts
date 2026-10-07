import { diffChanges, diffCreate, diffVisual, evalCode } from './analyze'
import { calc } from './calc'
import { render } from './create'
import { describe } from './describe'
import { getDesignGuidance } from './design-guidance'
import {
  setFill,
  setLayout,
  setLayoutChild,
  setRadius,
  setStroke,
  setText,
  setTextProperties,
  updateNode
} from './modify'
import { diffJSX, findNodes, getJSX, getNode, getSelection } from './read'
import type { ToolDef } from './schema'
import { stockPhoto } from './stock-photo'
import { batchUpdate, deleteNode, nodeResize, reparentNode } from './structure'
import { viewportZoomToFit } from './vector'

/**
 * Common authoring tools. Adapters discover these and EXTENDED_TOOLS through ALL_TOOLS,
 * then apply interface exposure and user permissions.
 */
export const CORE_TOOLS: ToolDef[] = [
  getDesignGuidance,
  // Read
  getSelection,
  getNode,
  findNodes,
  getJSX,
  // Create
  render,
  // Modify
  updateNode,
  setLayout,
  setLayoutChild,
  setRadius,
  setFill,
  setStroke,
  setText,
  setTextProperties,
  // Structure
  deleteNode,
  reparentNode,
  nodeResize,
  batchUpdate,
  // Stock photos
  stockPhoto,
  // Inspect & utility
  describe,
  diffChanges,
  diffCreate,
  diffJSX,
  diffVisual,
  calc,
  evalCode,
  viewportZoomToFit
]
