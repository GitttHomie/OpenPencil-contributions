import type { createComponentActions } from '#core/editor/components'
import type { createPageActions } from '#core/editor/pages'
import type { createSelectionActions } from '#core/editor/selection'
import type { createStructureActions } from '#core/editor/structure'

type ComponentActions = ReturnType<typeof createComponentActions>
type PageActions = ReturnType<typeof createPageActions>
type SelectionActions = ReturnType<typeof createSelectionActions>
type StructureActions = ReturnType<typeof createStructureActions>

export function createComponentBridge(
  components: ComponentActions,
  selection: SelectionActions,
  structure: StructureActions,
  pages: PageActions
) {
  return {
    createComponentFromSelection: () =>
      components.createComponentFromSelection(
        selection.getSelectedNodes(),
        structure.wrapSelectionInContainer
      ),
    createComponentSetFromComponents: () =>
      components.createComponentSetFromComponents(selection.getSelectedNodes()),
    createInstanceFromComponent: components.createInstanceFromComponent,
    detachInstance: () => components.detachInstance(selection.getSelectedNode()),
    focusComponent: (componentId: string) =>
      components.focusComponent(componentId, pages.switchPage),
    goToMainComponent: () =>
      components.goToMainComponent(selection.getSelectedNode(), pages.switchPage),
    getComponentSetPropertyDefs: components.getComponentSetPropertyDefs,
    createSlot: () => components.createSlot(selection.getSelectedNodes()),
    convertToSlot: components.convertToSlot,
    updateSlot: components.updateSlot,
    removeSlot: components.removeSlot,
    setBehaviour: components.setBehaviour,
    addBehaviourText: components.addBehaviourText,
    addBehaviourVariant: components.addBehaviourVariant,
    addBehaviourPart: components.addBehaviourPart,
    addBehaviourStates: components.addBehaviourStates,
    addPropertyDefinition: components.addPropertyDefinition,
    removePropertyDefinition: components.removePropertyDefinition,
    renamePropertyDefinition: components.renamePropertyDefinition,
    reorderPropertyDefinitions: components.reorderPropertyDefinitions,
    reorderVariants: components.reorderVariants,
    renameVariantValue: components.renameVariantValue,
    reorderVariantValues: components.reorderVariantValues,
    getVariantOptions: components.getVariantOptions,
    addVariantValue: components.addVariantValue,
    removeVariantValue: components.removeVariantValue,
    setVariantPropertyValue: components.setVariantPropertyValue,
    collectVariantOptions: components.collectVariantOptions,
    findVariantByValues: components.findVariantByValues,
    getDefaultVariantForComponentSet: components.getDefaultVariantForComponentSet,
    getComponentSetVariantConflicts: components.getComponentSetVariantConflicts,
    validateComponentSet: components.validateComponentSet,
    getVariantOptionAvailability: components.getVariantOptionAvailability,
    switchInstanceVariant: components.switchInstanceVariant,
    addVariant: components.addVariant,
    duplicateVariant: components.duplicateVariant,
    removeVariant: components.removeVariant,
    getInstanceComponentPropertyDefinitions: components.getInstanceComponentPropertyDefinitions,
    getInstanceComponentPropertyTarget: components.getInstanceComponentPropertyTarget,
    getNestedComponentPropertyCandidates: components.getNestedComponentPropertyCandidates,
    setNestedComponentPropertyExposure: components.setNestedComponentPropertyExposure,
    reorderExposedComponentProperties: components.reorderExposedComponentProperties,
    getComponentPropertyAuthoring: components.getComponentPropertyAuthoring,
    getComponentPropertyBindings: components.getComponentPropertyBindings,
    createComponentProperty: components.createComponentProperty,
    exposeComponentProperty: components.exposeComponentProperty,
    enableComponentProperty: components.enableComponentProperty,
    bindComponentProperty: components.bindComponentProperty,
    renameComponentProperty: components.renameComponentProperty,
    setComponentPropertyDefault: components.setComponentPropertyDefault,
    setComponentPropertyVariantDefault: components.setComponentPropertyVariantDefault,
    deleteComponentProperty: components.deleteComponentProperty,
    getInstanceComponentPropertyValue: components.getInstanceComponentPropertyValue,
    setInstanceComponentProperty: components.setInstanceComponentProperty,
    resetSlot: components.resetSlot,
    clearSlot: components.clearSlot,
    addInstanceToSlot: components.addInstanceToSlot
  }
}
