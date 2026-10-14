import type { Page } from '@playwright/test'

/** Test-owned workflow preferences and the scripted model's advertised image capability. */
export async function enableDesignChecks(page: Page, corrections: boolean) {
  await page.evaluate(async (correct) => {
    const preferencesPath = '/src/app/ai/design-checks/preferences.ts'
    const statePath = '/src/app/ai/design-checks/state.ts'
    const { designCheckSettings } = await import(preferencesPath)
    const { designCheckState } = await import(statePath)
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('Missing test editor')
    designCheckSettings.value = {
      automatic: true,
      corrections: correct,
      maxCorrectionPasses: 2,
      reviewer: 'design'
    }
    designCheckState(store).supportsImages = true
  }, corrections)
}
