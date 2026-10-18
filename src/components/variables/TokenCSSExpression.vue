<script setup lang="ts">
import { tv } from 'tailwind-variants'
import { computed, ref, useTemplateRef, watch } from 'vue'

import type { TokenUnit } from '@open-pencil/scene-graph'
import { useI18n } from '@open-pencil/vue'

import { cssExpressionProblem } from '@/app/editor/tokens/css-expression'
import type { CSSReferenceCandidate } from '@/app/editor/tokens/model'
import { VariablePicker } from '@/components/ui/binding'
import tokensPanelTheme from '@/theme/tokens-panel'

import { cssValueDialect } from './formula-field/dialects/css'
import type { FormulaSelection } from './formula-field/source'
import type TokenFormulaField from './TokenFormulaField.vue'

/** A value only CSS can draw, shown where the field is empty. */
const EXAMPLE = 'clamp(1rem, 4vw, 1.5rem)'

const css = defineModel<string>({ required: true })
const { id, label, unit, candidates, describedBy } = defineProps<{
  id: string
  label: string
  unit: TokenUnit
  /** Number tokens the expression can name as `var(--name)`. */
  candidates: CSSReferenceCandidate[]
  describedBy: string
}>()
const emit = defineEmits<{ commit: [css: string]; cancel: [] }>()
const { variables } = useI18n()
const ui = tv(tokensPanelTheme)()
const field = useTemplateRef<InstanceType<typeof TokenFormulaField>>('field')

const reference = (candidate: CSSReferenceCandidate) => `var(--${candidate.cssName})`
const completions = computed(() =>
  candidates.map((candidate) => ({
    label: `--${candidate.cssName}`,
    section: candidate.collection,
    detail: candidate.text,
    insert: reference(candidate)
  }))
)
const byReference = computed(
  () => new Map(candidates.map((candidate) => [reference(candidate), candidate]))
)
const pickerItems = computed(() =>
  candidates.map(({ id: candidateId, name, collection, text }) => ({
    id: candidateId,
    name,
    collection,
    text
  }))
)

/** A `var()` pill is named by the CSS name it writes; the tooltip gives the token. */
function resolveReference(source: string) {
  const candidate = byReference.value.get(source.replaceAll(' ', ''))
  if (!candidate) return undefined
  return {
    label: candidate.cssName,
    tooltip: `${candidate.collection} · ${candidate.name} · ${candidate.text}`
  }
}

/** Errors show once the expression is committed, as the value field's do. */
const error = ref('')
watch(css, () => (error.value = ''))
function message(text: string) {
  const problem = cssExpressionProblem(
    text,
    unit,
    new Set(candidates.map((candidate) => `--${candidate.cssName}`)),
    (property, value) => CSS.supports(property, value)
  )
  if (!problem) return ''
  if (problem.kind === 'unclosed') return variables.value.cssExpressionUnclosed
  if (problem.kind === 'negated-reference')
    return variables.value.cssExpressionNegated({ property: problem.property })
  if (problem.kind === 'unknown-token')
    return variables.value.cssExpressionUnknownToken({ name: problem.name })
  return variables.value.cssExpressionInvalid({ property: problem.property })
}
function commit() {
  const text = css.value.trim()
  error.value = text ? message(text) : ''
  if (error.value) return false
  emit('commit', text)
  return true
}
function enter() {
  if (commit()) field.value?.blur()
}

/** The picker puts `var(--name)` at the caret and gives the focus back to the field. */
const selection = ref<FormulaSelection | null>(null)
const insertionCaret = ref<number | null>(null)
function insert(candidateId: string) {
  const candidate = candidates.find((item) => item.id === candidateId)
  if (!candidate) return
  const text = reference(candidate)
  const range = selection.value ?? { start: css.value.length, end: css.value.length }
  css.value = css.value.slice(0, range.start) + text + css.value.slice(range.end)
  insertionCaret.value = range.start + text.length
}
function restoreFocus(event: Event) {
  if (insertionCaret.value === null) return
  event.preventDefault()
  const caret = insertionCaret.value
  insertionCaret.value = null
  field.value?.focus()
  field.value?.setSelectionRange(caret, caret)
}

defineExpose({ focus: () => field.value?.focus() })
</script>

<template>
  <!-- The row's parts sit in the value grid's columns, the field under the value field. -->
  <div class="contents">
    <div :class="ui.expressionField()">
      <TokenFormulaField
        :id="id"
        ref="field"
        v-model="css"
        :dialect="cssValueDialect"
        :label="label"
        prefix="CSS"
        :placeholder="EXAMPLE"
        :completions="completions"
        :resolve="resolveReference"
        :invalid="Boolean(error)"
        :described-by="describedBy"
        @change="commit"
        @enter="enter"
        @cancel="emit('cancel')"
        @selection="selection = $event"
      />
    </div>
    <div :class="ui.expressionActions()">
      <VariablePicker
        :items="pickerItems"
        state="unbound"
        :trigger-label="variables.useVariable"
        :search-placeholder="variables.searchVariables"
        :empty-label="variables.noMatchingVariables"
        :detach-label="variables.detachVariable"
        @select="insert"
        @close-auto-focus="restoreFocus"
      />
    </div>
    <p v-if="error" :class="[ui.error(), ui.expressionField()]" role="alert">{{ error }}</p>
  </div>
</template>
