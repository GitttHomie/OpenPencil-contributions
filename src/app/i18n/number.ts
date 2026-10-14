import { locale } from '@open-pencil/vue'

const numberFormats = new Map<string, Intl.NumberFormat>()
const maximumFractionDigits = 2
const inputNumberFormat = new Intl.NumberFormat('en-US', {
  maximumFractionDigits,
  useGrouping: false
})

/** Editable numbers use the expression parser's decimal point and no grouping separators. */
export function formatInputNumber(value: number): string {
  return inputNumberFormat.format(value)
}

/** Numbers follow the app's language, not the browser's, like the rest of the interface. */
export function formatNumber(value: number): string {
  const language = locale.get()
  let format = numberFormats.get(language)
  if (!format) {
    format = new Intl.NumberFormat(language, { maximumFractionDigits })
    numberFormats.set(language, format)
  }
  return format.format(value)
}
