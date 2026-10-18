/** The source spelling stays intact when a reference is displayed as an atomic pill. */
export interface FormulaPill {
  label: string
  displayValue: string
}

export interface FormulaSelection {
  start: number
  end: number
}

export interface FormulaSegment extends FormulaSelection {
  source: string
  pill?: FormulaPill
}

/** Keep offsets in source coordinates, even when a reference is displayed as a pill. */
export function formulaSegments(
  source: string,
  resolve: (reference: string) => FormulaPill | undefined
) {
  const segments: FormulaSegment[] = []
  let start = 0
  for (const match of source.matchAll(/\{[^{}]+\}/g)) {
    const pill = resolve(match[0])
    if (!pill) continue
    if (start < match.index)
      segments.push({ source: source.slice(start, match.index), start, end: match.index })
    const end = match.index + match[0].length
    segments.push({ source: match[0], start: match.index, end, pill })
    start = end
  }
  segments.push({ source: source.slice(start), start, end: source.length })
  return segments
}
