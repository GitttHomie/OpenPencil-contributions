import type { Page } from '@playwright/test'

/** Native resize errors have no Error object and do not reliably emit Playwright's pageerror. */
export async function trackResizeErrors(page: Page): Promise<string[]> {
  const errors: string[] = []
  const bindingName = '__openPencilResizeError'
  await page.exposeBinding(bindingName, (_, message: string) => {
    errors.push(message)
  })
  function listen(name: string) {
    window.addEventListener('error', (event) => {
      if (!event.message.includes('ResizeObserver')) return
      const report: unknown = Reflect.get(globalThis, name)
      if (typeof report === 'function') void report(event.message)
    })
  }
  await page.addInitScript(listen, bindingName)
  await page.evaluate(listen, bindingName)
  return errors
}
