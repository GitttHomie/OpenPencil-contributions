<script setup lang="ts">
import { CollapsibleContent, CollapsibleRoot, CollapsibleTrigger } from 'reka-ui'
import { ref, watch } from 'vue'

import { useComponentPropertyAuthoring, usePanelMessages } from '@open-pencil/vue'

import AppButton from '@/components/ui/button/AppButton.vue'
import IconButton from '@/components/ui/button/IconButton.vue'
import PanelSection from '@/components/ui/panel/PanelSection.vue'
import ReorderList from '@/components/ui/panel/ReorderList.vue'
import { collapsibleContentMotion } from '@/theme/collapsible/collapsible'

import CreatePropertyDefinition from './CreatePropertyDefinition.vue'
import ExposePropertyField from './ExposePropertyField.vue'
import NestedPropertyExposure from './NestedPropertyExposure.vue'
import PropertyBindings from './PropertyBindings.vue'
import PropertyDefinitionRow from './PropertyDefinitionRow.vue'
import PropertyValueField from './PropertyValueField.vue'
import type { ComponentPropertyFocusRequest } from './usePropertyValueFocus'

const { focusRequest } = defineProps<{ focusRequest?: ComponentPropertyFocusRequest | null }>()

const {
  context,
  definitions,
  entries,
  removeNested,
  setNestedDefault,
  variants,
  manage,
  expose,
  create,
  bind,
  rename,
  remove,
  reorder,
  canReorder,
  setDefault,
  setVariantDefault,
  selectSet,
  optionsFor,
  changeAttributeValue,
  componentName,
  selectBinding,
  nestedComponents,
  setNestedExposure
} = useComponentPropertyAuthoring()
const panels = usePanelMessages()
const expandedProperties = ref(new Set<string>())
watch(
  () => focusRequest,
  (request) => {
    if (request?.kind === 'default')
      expandedProperties.value.add(`${request.nodeId}:${request.propertyId}`)
  },
  { immediate: true }
)
const fieldTypes = { TEXT: 'TEXT', VISIBLE: 'BOOLEAN', INSTANCE_SWAP: 'INSTANCE_SWAP' } as const

function setPropertyOpen(ownerId: string, propertyId: string, open: boolean) {
  const key = `${ownerId}:${propertyId}`
  if (open) expandedProperties.value.add(key)
  else expandedProperties.value.delete(key)
}

function propertyTypeLabel(type: string) {
  if (type === 'TEXT') return panels.value.componentPropertyString
  if (type === 'BOOLEAN') return panels.value.componentPropertyBoolean
  return panels.value.componentPropertySwap
}

function typeLabel(type: string) {
  if (type === 'TEXT') return panels.value.textContent
  if (type === 'BOOLEAN' || type === 'VISIBLE') return panels.value.layerVisibility
  return panels.value.nestedInstance
}
</script>

<template>
  <PanelSection
    v-if="context"
    :key="context.node.id"
    :label="manage ? panels.componentProperties : panels.exposeComponentProperty"
    :ui="{ title: 'text-component' }"
  >
    <AppButton
      v-if="manage && context.node.id !== context.owner.id"
      size="xs"
      variant="soft"
      @click="selectSet()"
    >
      <icon-lucide-component class="size-3.5" />
      {{ panels.manageComponentSet }}
    </AppButton>
    <div v-else-if="manage" class="flex flex-col gap-field-group">
      <CreatePropertyDefinition
        :key="context.node.id"
        :disabled="!context.editable"
        :options="optionsFor('')"
        :create="
          (name, type, value) => (context ? create(context.owner.id, name, type, value) : null)
        "
      >
        <template #nested="{ close }">
          <NestedPropertyExposure
            :owner-id="context.owner.id"
            :candidates="nestedComponents"
            :disabled="!context.editable"
            :update="setNestedExposure"
            @done="close"
          />
        </template>
      </CreatePropertyDefinition>
      <ReorderList
        :items="entries"
        :get-id="(item) => item.id"
        :can-move="canReorder"
        :disabled="!context.editable"
        @move="reorder"
      >
        <template #default="{ item }">
          <PropertyDefinitionRow
            v-if="item.kind === 'nested'"
            :data-property="item.id"
            :open="expandedProperties.has(`${context.owner.id}:${item.id}`)"
            :source-name="item.componentName"
            :name="item.definition.name"
            :kind="item.definition.type"
            :type-label="propertyTypeLabel(item.definition.type)"
            :value="item.value"
            :options="item.options"
            :disabled="!context.editable"
            @update="setNestedDefault(item.nodeId, item.definition.id, $event)"
            @remove="removeNested(item.nodeId, item.definition.id)"
            @update:open="setPropertyOpen(context.owner.id, item.id, $event)"
          />
          <template v-else>
            <template v-for="definition in [item.definition]" :key="definition.id">
              <PropertyDefinitionRow
                :data-property="definition.id"
                :open="expandedProperties.has(`${definition.ownerId}:${definition.id}`)"
                :name="definition.name"
                :kind="definition.type"
                :focus-request="
                  focusRequest?.kind === 'default' &&
                  focusRequest.nodeId === definition.ownerId &&
                  focusRequest.propertyId === definition.id
                    ? focusRequest.request
                    : undefined
                "
                :type-label="propertyTypeLabel(definition.type)"
                :value="definition.defaultValue"
                :options="definition.type === 'INSTANCE_SWAP' ? optionsFor(definition.id) : []"
                :disabled="!context.editable"
                :rename="(name) => rename(definition.ownerId, definition.id, name)"
                @update="setDefault(definition.ownerId, definition.id, $event)"
                @remove="remove(definition.ownerId, definition.id)"
                @update:open="setPropertyOpen(definition.ownerId, definition.id, $event)"
              >
                <p v-if="variants.length" class="text-[11px] text-muted">
                  {{
                    definition.variants.length === variants.length
                      ? panels.allVariants
                      : panels.usedInVariants({
                          count: definition.variants.length,
                          total: variants.length
                        })
                  }}
                </p>
                <p v-if="!definition.bindings.length" class="text-[11px] text-muted">
                  {{ panels.noComponentPropertyBindings }}
                </p>
                <PropertyBindings
                  :groups="definition.bindingGroups"
                  :total-variants="variants.length"
                  :disabled="!context.editable"
                  @select="selectBinding"
                  @unbind="
                    (binding) =>
                      binding.field !== 'SLOT_CONTENT' && bind(binding.nodeId, binding.field, null)
                  "
                />
                <CollapsibleRoot
                  v-if="definition.shared && definition.variants.length"
                  v-slot="{ open }"
                >
                  <CollapsibleTrigger as-child>
                    <AppButton size="xs" variant="ghost" class="w-full justify-start">
                      <icon-lucide-chevron-right
                        class="size-3.5 transition-transform data-[open]:rotate-90 motion-reduce:transition-none"
                        :data-open="open || undefined"
                      />
                      {{ panels.variantDefaults }}
                    </AppButton>
                  </CollapsibleTrigger>
                  <CollapsibleContent :class="collapsibleContentMotion">
                    <div class="flex flex-col gap-field-group border-t border-border pt-2">
                      <div
                        v-for="variant in definition.variants"
                        :key="variant.id"
                        class="flex flex-col gap-field-label"
                      >
                        <span class="text-[11px] text-muted">{{ variant.name }}</span>
                        <div class="flex items-center gap-1">
                          <PropertyValueField
                            :kind="definition.type"
                            :value="variant.value"
                            :label="`${variant.name}: ${panels.componentPropertyDefault}`"
                            :options="
                              definition.type === 'INSTANCE_SWAP' ? optionsFor(definition.id) : []
                            "
                            :disabled="!context.editable"
                            @update="setVariantDefault(variant.id, definition.id, $event)"
                          />
                          <IconButton
                            v-if="variant.overridden"
                            :label="`${panels.useSharedDefault}: ${variant.name}`"
                            :disabled="!context.editable"
                            @click="setVariantDefault(variant.id, definition.id, null)"
                          >
                            <icon-lucide-rotate-ccw class="size-3.5" />
                          </IconButton>
                        </div>
                      </div>
                    </div>
                  </CollapsibleContent>
                </CollapsibleRoot>
              </PropertyDefinitionRow>
            </template>
          </template>
        </template>
      </ReorderList>
    </div>
    <div v-else class="flex flex-col gap-field-group">
      <ExposePropertyField
        v-for="field in context.fields"
        :key="`${context.node.id}:${field}`"
        :label="typeLabel(field)"
        :kind="fieldTypes[field]"
        :definitions="definitions.filter((definition) => definition.type === fieldTypes[field])"
        :property-id="
          context.node.componentPropertyReferences.find((reference) => reference.field === field)
            ?.propertyId
        "
        :suggested-name="
          field === 'VISIBLE' ? `${context.node.name} ${panels.layerVisibility}` : context.node.name
        "
        :value="
          field === 'VISIBLE'
            ? String(context.node.visible)
            : field === 'TEXT'
              ? context.node.text
              : componentName(context.node.componentId ?? '')
        "
        :disabled="!context.editable"
        :expose="(name) => (context ? expose(context.node.id, field, name) : null)"
        :bind="(id) => (context ? bind(context.node.id, field, id) : false)"
        :change-value="(value) => changeAttributeValue(field, value)"
      />
    </div>
  </PanelSection>
</template>
