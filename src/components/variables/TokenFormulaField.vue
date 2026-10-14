<script setup lang="ts">
import { useManualRefHistory } from '@vueuse/core'
import { tv } from 'tailwind-variants'
import { onMounted, shallowRef, useTemplateRef, watch } from 'vue'

import { useI18n } from '@open-pencil/vue'

import inputTheme from '@/theme/input/input'
import tokensPanelTheme from '@/theme/tokens-panel'

import {
  formulaFieldSelection,
  formulaFieldText,
  renderFormulaField,
  selectFormulaField,
  type FormulaPill,
  type FormulaSelection
} from './formula-field'

const model = defineModel<string>({ required: true })
const { resolve, state = 'idle' } = defineProps<{
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
const icon = useTemplateRef<HTMLSpanElement>('icon')
const ui = tv(tokensPanelTheme)()
const inputUI = tv(inputTheme)
const { variables } = useI18n()
const historyValue = shallowRef({
  source: model.value,
  range: { start: model.value.length, end: model.value.length }
})
const history = useManualRefHistory(historyValue, { capacity: 100 })
let composing = false
let updating = false

function remember() {
  if (!field.value) return
  const range = formulaFieldSelection(field.value)
  if (range) emit('selection', range)
}
function draw(range?: FormulaSelection | null, source = model.value) {
  const root = field.value
  if (!root || composing) return
  renderFormulaField(
    root,
    source,
    resolve,
    (name) => variables.value.removeReference({ name }),
    icon.value?.firstElementChild ?? null,
    {
      pill: ui.formulaPill(),
      label: ui.formulaPillLabel(),
      value: ui.formulaPillValue(),
      remove: ui.formulaPillRemove()
    }
  )
  if (range) selectFormulaField(root, range.start, range.end)
}
function update(source: string, range: FormulaSelection) {
  updating = true
  if (source !== historyValue.value.source) {
    historyValue.value = { source, range }
    history.commit()
  }
  model.value = source
  draw(range, source)
  updating = false
  emit('selection', range)
}
function input() {
  if (composing || !field.value) return
  const source = formulaFieldText(field.value)
  const range = formulaFieldSelection(field.value) ?? { start: source.length, end: source.length }
  update(source, range)
}
function startComposition() {
  composing = true
}
function endComposition() {
  composing = false
  input()
}
function replace(text: string) {
  const root = field.value
  if (!root) return
  const range = formulaFieldSelection(root)
  if (!range) return
  const source = formulaFieldText(root)
  const caret = range.start + text.length
  update(source.slice(0, range.start) + text + source.slice(range.end), {
    start: caret,
    end: caret
  })
}
function clipboard(event: ClipboardEvent, cut = false) {
  if (!field.value) return
  const range = formulaFieldSelection(field.value)
  if (!range) return
  event.preventDefault()
  event.clipboardData?.setData('text/plain', model.value.slice(range.start, range.end))
  if (cut) replace('')
}
function blur(event: FocusEvent) {
  if (event.relatedTarget instanceof Node && field.value?.contains(event.relatedTarget)) return
  emit('change')
}
function preserveEditingFocus(event: PointerEvent) {
  if (event.target instanceof Element && event.target.closest('[data-remove-reference]'))
    event.preventDefault()
}
function remove(event: Event) {
  const button =
    event.target instanceof Element ? event.target.closest('[data-remove-reference]') : null
  const pill = button?.parentElement
  const root = field.value
  if (!pill || !root || pill.parentElement !== root) return
  let start = 0
  for (const child of root.childNodes) {
    if (child === pill) break
    start += formulaFieldText(child).length
  }
  const end = start + formulaFieldText(pill).length
  root.focus()
  update(model.value.slice(0, start) + model.value.slice(end), { start, end: start })
}
function editSelection(event: KeyboardEvent, root: HTMLElement, range: FormulaSelection) {
  if (event.code === 'Home' || event.code === 'End') {
    event.preventDefault()
    const end = event.code === 'Home' ? 0 : model.value.length
    const start = event.shiftKey ? range.start : end
    selectFormulaField(root, Math.min(start, end), Math.max(start, end))
    remember()
    return true
  }
  if (event.code === 'Backspace' || event.code === 'Delete') {
    if (range.start !== range.end) {
      event.preventDefault()
      replace('')
      return true
    }
    let start = 0
    for (const child of root.childNodes) {
      const end = start + formulaFieldText(child).length
      if (
        child instanceof HTMLElement &&
        child.dataset.reference !== undefined &&
        (event.code === 'Backspace' ? range.start === end : range.start === start)
      ) {
        event.preventDefault()
        update(model.value.slice(0, start) + model.value.slice(end), { start, end: start })
        return true
      }
      start = end
    }
  }
  return false
}
function keydown(event: KeyboardEvent) {
  if (composing || event.isComposing) return
  if (
    event.target instanceof Element &&
    event.target.closest('[data-remove-reference]') &&
    (event.code === 'Enter' || event.code === 'Space')
  ) {
    event.preventDefault()
    event.stopPropagation()
    remove(event)
    return
  }
  if ((event.metaKey || event.ctrlKey) && (event.code === 'KeyZ' || event.code === 'KeyY')) {
    event.preventDefault()
    event.stopPropagation()
    if (event.shiftKey || event.code === 'KeyY') history.redo()
    else history.undo()
    update(historyValue.value.source, historyValue.value.range)
    return
  }
  const root = field.value
  const range = root ? formulaFieldSelection(root) : null
  if (root && range && editSelection(event, root, range)) return
  if (event.code === 'Enter' || event.code === 'Escape') {
    event.preventDefault()
    event.stopPropagation()
    if (event.code === 'Enter') emit('enter')
    else emit('cancel')
  }
}
watch(
  () => [model.value, resolve],
  () => {
    if (model.value !== historyValue.value.source) {
      historyValue.value = {
        source: model.value,
        range: { start: model.value.length, end: model.value.length }
      }
      history.commit()
    }
    if (!updating)
      draw(
        field.value && document.activeElement === field.value
          ? formulaFieldSelection(field.value)
          : null
      )
  },
  { flush: 'sync' }
)
onMounted(() => draw())
defineExpose({
  focus: () => field.value?.focus(),
  blur: () => {
    const root = field.value
    root?.blur()
    if (root && formulaFieldSelection(root)) root.ownerDocument.getSelection()?.removeAllRanges()
  },
  setSelectionRange: (start: number, end: number) => {
    if (field.value) selectFormulaField(field.value, start, end)
  }
})
defineOptions({ inheritAttrs: false })
</script>

<template>
  <div class="min-w-0">
    <span ref="icon" class="hidden" aria-hidden="true"><icon-lucide-x class="size-3" /></span>
    <div
      ref="field"
      v-bind="$attrs"
      role="textbox"
      aria-multiline="false"
      contenteditable="true"
      spellcheck="false"
      :class="[inputUI({ size: 'sm', state }), ui.formulaInput()]"
      @input="input"
      @blur="blur"
      @focus="remember"
      @mouseup="remember"
      @keyup="remember"
      @keydown="keydown"
      @click="remove"
      @pointerdown="preserveEditingFocus"
      @paste.prevent="replace($event.clipboardData?.getData('text/plain') ?? '')"
      @copy="clipboard"
      @cut="clipboard($event, true)"
      @drop.prevent
      @compositionstart="startComposition"
      @compositionend="endComposition"
    />
  </div>
</template>
