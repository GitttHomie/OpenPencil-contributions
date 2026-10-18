<script setup lang="ts">
import { tv } from 'tailwind-variants'
import { useTemplateRef } from 'vue'

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
  unit
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
const editing = useFormulaField(field, model, {
  dialect,
  label: () => label,
  placeholder: () => placeholder,
  completions: () => completions,
  attributes: () => ({
    id,
    'aria-invalid': String(invalid),
    ...(describedBy ? { 'aria-describedby': describedBy } : {}),
    'aria-multiline': 'false'
  }),
  resolve: (source) => resolve(source),
  onChange: () => emit('change'),
  onEnter: () => emit('enter'),
  onCancel: () => emit('cancel'),
  onSelection: (range) => emit('selection', range)
})

defineExpose({
  focus: editing.focus,
  blur: editing.blur,
  setSelectionRange: editing.setSelectionRange
})
defineOptions({ inheritAttrs: false })
</script>

<template>
  <div
    :class="[inputUI({ size: 'sm' }), ui.formulaField()]"
    :data-invalid="invalid ? '' : undefined"
    @pointerdown.self.prevent="editing.focus()"
  >
    <span v-if="prefix" :class="[ui.formulaAffix(), ui.formulaPrefix()]" aria-hidden="true">{{
      prefix
    }}</span>
    <div ref="field" :class="ui.formulaEditor()" />
    <span v-if="suffix" :class="[ui.formulaAffix(), ui.formulaSuffix()]" aria-hidden="true"
      >= {{ suffix }}</span
    >
    <span v-else-if="unit" :class="ui.formulaAffix()" aria-hidden="true">{{ unit }}</span>
  </div>
</template>
