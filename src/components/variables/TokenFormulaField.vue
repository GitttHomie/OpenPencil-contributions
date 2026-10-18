<script setup lang="ts">
import { PopoverAnchor, PopoverContent, PopoverPortal, PopoverRoot } from 'reka-ui'
import { tv } from 'tailwind-variants'
import { nextTick, ref, useTemplateRef } from 'vue'

import { useI18n, useRetainedPopup } from '@open-pencil/vue'

import Tip from '@/components/ui/overlay/Tip.vue'
import inputTheme from '@/theme/input/input'
import tokensPanelTheme from '@/theme/tokens-panel'

import type { ExpressionDialect, ReferenceCompletion } from './formula-field/dialects/types'
import type { FormulaPill, FormulaSelection } from './formula-field/source'
import { useFormulaField } from './formula-field/useFormulaField'

const model = defineModel<string>({ required: true })
const {
  dialect,
  id,
  label,
  placeholder = '',
  invalid = false,
  describedBy,
  resolve,
  completions,
  prefix,
  suffix,
  unit,
  expanded = false
} = defineProps<{
  /** The syntax the field edits; fixed for the field's lifetime. */
  dialect: ExpressionDialect
  completions: readonly ReferenceCompletion[]
  id: string
  label: string
  placeholder?: string
  invalid?: boolean
  describedBy?: string
  resolve: (source: string) => FormulaPill | undefined
  /** What the field holds, such as CSS, shown at its start. */
  prefix?: string
  /** What the formula gives, shown at the field's end. */
  suffix?: string
  /** The unit a plain number is in, shown at the field's end in place of a result. */
  unit?: string
  /** The larger editor a field opens for a long value, which opens no editor of its own. */
  expanded?: boolean
}>()
const emit = defineEmits<{
  change: []
  enter: []
  cancel: []
  selection: [range: FormulaSelection]
}>()
const field = useTemplateRef<HTMLDivElement>('field')
const ui = tv(tokensPanelTheme)()
const inputUI = tv(inputTheme)
const { variables } = useI18n()

/**
 * The larger editor edits the same draft. While it is open, this field does not commit on
 * losing focus; closing it with Enter commits, Escape returns here, and clicking away commits.
 */
const editorOpen = ref(false)
const { portalActive } = useRetainedPopup(editorOpen)
const larger = useTemplateRef<{
  focus: () => void
  setSelectionRange: (start: number, end: number) => void
}>('larger')
let closedBy: 'enter' | 'cancel' | null = null

const editing = useFormulaField(field, model, {
  dialect,
  label: () => label,
  placeholder: () => placeholder,
  completions: () => completions,
  attributes: () => ({
    id,
    'aria-invalid': String(invalid),
    ...(describedBy ? { 'aria-describedby': describedBy } : {}),
    'aria-multiline': 'true'
  }),
  resolve: (source) => resolve(source),
  onChange: () => {
    if (!editorOpen.value) emit('change')
  },
  onEnter: () => emit('enter'),
  onCancel: () => emit('cancel'),
  onSelection: (range) => emit('selection', range)
})

function openEditor() {
  closedBy = null
  editorOpen.value = true
}
function focusLarger() {
  void nextTick(() => {
    larger.value?.focus()
    larger.value?.setSelectionRange(model.value.length, model.value.length)
  })
}
function closeEditor(reason: 'enter' | 'cancel') {
  closedBy = reason
  setEditorOpen(false)
}
function setEditorOpen(open: boolean) {
  editorOpen.value = open
  if (open) return
  if (closedBy === 'enter') emit('enter')
  else if (closedBy === null) emit('change')
}
function returnFocus(event: Event) {
  if (closedBy !== 'cancel') return
  event.preventDefault()
  editing.focus()
}

defineExpose({
  focus: editing.focus,
  blur: editing.blur,
  setSelectionRange: editing.setSelectionRange
})
defineOptions({ inheritAttrs: false })
</script>

<template>
  <PopoverRoot :open="editorOpen" @update:open="setEditorOpen">
    <PopoverAnchor as-child>
      <div
        :class="[inputUI({ size: 'sm' }), ui.formulaField({ expanded })]"
        :data-invalid="invalid ? '' : undefined"
        @pointerdown.self.prevent="editing.focus()"
      >
        <span v-if="prefix" :class="[ui.formulaAffix(), ui.formulaPrefix()]" aria-hidden="true">{{
          prefix
        }}</span>
        <div ref="field" :class="ui.formulaEditor()" />
        <!-- Before the result, so its space while hidden falls in the field's empty part. -->
        <Tip v-if="!expanded" :label="variables.expandEditor">
          <button
            type="button"
            :class="ui.formulaExpand()"
            :aria-label="variables.expandEditor"
            data-test-id="formula-expand"
            @pointerdown.prevent
            @click="openEditor"
          >
            <icon-lucide-maximize-2 class="size-3" />
          </button>
        </Tip>
        <span v-if="suffix" :class="[ui.formulaAffix(), ui.formulaSuffix()]" aria-hidden="true"
          >= {{ suffix }}</span
        >
        <span v-else-if="unit" :class="ui.formulaAffix()" aria-hidden="true">{{ unit }}</span>

        <span v-if="!expanded && $slots.actions" :class="ui.formulaActions()">
          <slot name="actions" />
        </span>
      </div>
    </PopoverAnchor>
    <PopoverPortal v-if="!expanded && portalActive">
      <PopoverContent
        side="left"
        align="start"
        :side-offset="8"
        :collision-padding="8"
        :aria-label="label"
        :class="ui.formulaEditorPanel()"
        @open-auto-focus.prevent="focusLarger"
        @close-auto-focus="returnFocus"
      >
        <TokenFormulaField
          :id="`${id}-expanded`"
          ref="larger"
          v-model="model"
          expanded
          :dialect="dialect"
          :label="label"
          :placeholder="placeholder"
          :completions="completions"
          :resolve="resolve"
          :invalid="invalid"
          :prefix="prefix"
          :suffix="suffix"
          :unit="unit"
          @enter="closeEditor('enter')"
          @cancel="closeEditor('cancel')"
          @selection="emit('selection', $event)"
        />
        <p :class="ui.hint()">{{ variables.expandEditorHint }}</p>
      </PopoverContent>
    </PopoverPortal>
  </PopoverRoot>
</template>
