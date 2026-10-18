<script setup lang="ts">
import { tv } from 'tailwind-variants'
import { useTemplateRef } from 'vue'

import { useI18n } from '@open-pencil/vue'

import inputTheme from '@/theme/input/input'
import tokensPanelTheme from '@/theme/tokens-panel'

import type { FormulaCompletion } from './formula-field/completion'
import type { FormulaPill, FormulaSelection } from './formula-field/source'
import { useFormulaField } from './formula-field/useFormulaField'

const model = defineModel<string>({ required: true })
const {
  id,
  label,
  invalid,
  describedBy,
  resolve,
  completions,
  state = 'idle'
} = defineProps<{
  completions: readonly FormulaCompletion[]
  id: string
  label: string
  invalid: boolean
  describedBy: string
  resolve: (source: string) => FormulaPill | undefined
  state?: 'idle' | 'bound' | 'invalid'
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
const editing = useFormulaField(field, model, {
  label: () => label,
  completions: () => completions,
  attributes: () => ({
    id,
    'aria-invalid': String(invalid),
    'aria-describedby': describedBy,
    'aria-multiline': 'false',
    class: `${inputUI({ size: 'sm', state })} ${ui.formulaInput()}`
  }),
  resolve: (source) => resolve(source),
  removeLabel: (name) => variables.value.removeReference({ name }),
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
  <div ref="field" class="min-w-0" />
</template>
