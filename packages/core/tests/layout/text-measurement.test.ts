import { afterEach, beforeEach, describe, expect, test } from 'bun:test'

import {
  getTextMeasurer,
  installTextMeasurer,
  setTextMeasurer,
  type TextMeasurer
} from '#core/layout/text-measurement'

const measurer =
  (width: number): TextMeasurer =>
  () => ({ width, height: 10 })

describe('installTextMeasurer', () => {
  const baseline = measurer(0)
  let uninstallBaseline: () => void
  beforeEach(() => {
    uninstallBaseline = installTextMeasurer(baseline)
  })
  afterEach(() => {
    uninstallBaseline()
    setTextMeasurer(null)
  })

  test('falls back to the most recent measurer still installed', () => {
    const first = measurer(1)
    const second = measurer(2)
    const uninstallFirst = installTextMeasurer(first)
    const uninstallSecond = installTextMeasurer(second)
    expect(getTextMeasurer()).toBe(second)

    uninstallSecond()
    expect(getTextMeasurer()).toBe(first)
    uninstallFirst()
    expect(getTextMeasurer()).toBe(baseline)
  })

  test('uninstalling an earlier measurer keeps the current one', () => {
    const first = measurer(1)
    const second = measurer(2)
    const uninstallFirst = installTextMeasurer(first)
    const uninstallSecond = installTextMeasurer(second)
    uninstallFirst()
    expect(getTextMeasurer()).toBe(second)
    uninstallSecond()
    expect(getTextMeasurer()).toBe(baseline)
  })
})
