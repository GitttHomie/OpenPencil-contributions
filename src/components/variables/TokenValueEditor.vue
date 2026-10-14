<script setup lang="ts">
import { computedAsync } from '@vueuse/core'
import { tv } from 'tailwind-variants'
import { computed, nextTick, ref, useId, useTemplateRef, watch } from 'vue'

import { loadTokenValidator } from '@open-pencil/dom-css/export'
import type { Variable } from '@open-pencil/scene-graph'
import { useI18n } from '@open-pencil/vue'

import {
  tokenValueText,
  type AliasCandidate,
  type TokenFormulaActions
} from '@/app/editor/tokens/model'
import {
  parseTokenEditorText,
  tokenEditorText,
  type TokenValueEdit
} from '@/app/editor/tokens/value-editor'
import { VariablePicker } from '@/components/ui/binding'
import tokensPanelTheme from '@/theme/tokens-panel'

import type { FormulaSelection } from './formula-field'
import type TokenFormulaField from './TokenFormulaField.vue'

const { variable, modeId, label, candidates, formula } = defineProps<{
  variable: Variable
  modeId: string
  label: string
  candidates: AliasCandidate[]
  formula: TokenFormulaActions
}>()
const emit = defineEmits<{ apply: [edit: TokenValueEdit]; done: [] }>()
const { variables } = useI18n()
const ui = tv(tokensPanelTheme)()
const fieldId = useId()
const draft = ref('')
const commitError = ref('')
const field = useTemplateRef<InstanceType<typeof TokenFormulaField>>('field')
const selection = ref<FormulaSelection | null>(null)
let insertionCaret: number | null = null
let applying = false
const validator = computedAsync(loadTokenValidator, null)
const saved = computed(() => tokenEditorText(variable, modeId, formula))
watch(
  () => [variable.id, modeId, saved.value],
  () => {
    // A blur commit must not normalize the source and lose the picker insertion range.
    if (applying) return
    draft.value = saved.value
    selection.value = null
  },
  { immediate: true }
)
watch(draft, () => {
  commitError.value = ''
})
const alias = computed(() => {
  const value = variable.valuesByMode[modeId]
  return typeof value === 'object' && 'aliasId' in value ? value.aliasId : undefined
})
const pickerItems = computed(() =>
  candidates.map((candidate) => {
    try {
      const { resolved } = formula.parse(modeId, formula.reference(candidate.id))
      return { ...candidate, text: tokenValueText(variable, resolved) }
    } catch {
      return { ...candidate, text: '—' }
    }
  })
)
const resolveReference = computed(() => {
  const items = new Map(pickerItems.value.map((candidate) => [candidate.id, candidate]))
  return (source: string) => {
    try {
      const { value } = formula.parse(modeId, source)
      if (typeof value !== 'object' || !('aliasId' in value)) return
      const candidate = items.get(value.aliasId)
      if (candidate) return { label: candidate.name, displayValue: candidate.text }
    } catch {
      // Incomplete or invalid references remain editable source text.
      return undefined
    }
  }
})
function parse() {
  return parseTokenEditorText(
    variable,
    modeId,
    draft.value,
    formula,
    (text) =>
      validator.value?.declaration('value', text) === true &&
      ['width', 'opacity', 'z-index'].some((property) => CSS.supports(property, text))
  )
}
const preview = computed(() => {
  try {
    return { result: parse(), error: '' }
  } catch (error) {
    return { result: undefined, error: error instanceof Error ? error.message : String(error) }
  }
})
function apply() {
  if (draft.value === saved.value) return true
  try {
    const edit = parse()
    applying = true
    emit('apply', edit)
    void nextTick(() => {
      applying = false
    })
    return true
  } catch (error) {
    commitError.value = error instanceof Error ? error.message : String(error)
    return false
  }
}
function done() {
  if (!apply()) return
  field.value?.blur()
  emit('done')
}
function cancel() {
  draft.value = saved.value
  commitError.value = ''
  field.value?.blur()
}
function insert(id: string) {
  const reference = formula.reference(id)
  const literal = preview.value.result?.kind === 'literal'
  const range =
    literal || !selection.value ? { start: 0, end: draft.value.length } : selection.value
  draft.value = draft.value.slice(0, range.start) + reference + draft.value.slice(range.end)
  insertionCaret = range.start + reference.length
}
function restoreInputFocus(event: Event) {
  if (insertionCaret === null) return
  event.preventDefault()
  const caret = insertionCaret
  insertionCaret = null
  field.value?.focus()
  field.value?.setSelectionRange(caret, caret)
  selection.value = { start: caret, end: caret }
}
function detach() {
  const resolved = formula.parse(modeId, formula.format(variable.valuesByMode[modeId])).resolved
  draft.value = tokenValueText(variable, resolved)
  apply()
}
</script>

<template>
  <div :class="ui.field()">
    <div :class="ui.valueRow()">
      <TokenFormulaField
        ref="field"
        :id="fieldId"
        v-model="draft"
        :aria-label="label"
        :resolve="resolveReference"
        :aria-invalid="Boolean(commitError || preview.error)"
        :aria-describedby="`${fieldId}-result`"
        :state="commitError || preview.error ? 'invalid' : alias ? 'bound' : 'idle'"
        @change="apply"
        @enter="done"
        @cancel="cancel"
        @selection="selection = $event"
      />
      <VariablePicker
        :items="pickerItems"
        :selected="alias"
        :state="alias ? 'bound' : 'unbound'"
        :trigger-label="variables.insertReference"
        :search-placeholder="variables.searchVariables"
        :empty-label="variables.noMatchingVariables"
        :detach-label="variables.detachVariable"
        @select="insert"
        @detach="detach"
        @close-auto-focus="restoreInputFocus"
      />
    </div>
    <p
      :id="`${fieldId}-result`"
      :class="preview.error || commitError ? ui.error() : ui.hint()"
      aria-live="polite"
    >
      {{
        commitError ||
        preview.error ||
        `${variables.formulaResult}: ${tokenValueText(variable, preview.result?.resolved)}`
      }}
    </p>
    <span v-if="preview.result?.kind === 'css'" :class="ui.hint()">{{
      variables.expressionHint
    }}</span>
  </div>
</template>
