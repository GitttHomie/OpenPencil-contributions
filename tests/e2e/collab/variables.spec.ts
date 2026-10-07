import { expect, test } from '@playwright/test'

import { collaborationErrors, createPeer, startRelay, type Peer } from '#tests/helpers/collab/room'
import {
  changeSharedColor,
  changeSharedPadding,
  readVariableScene,
  renameSharedPadding,
  seedVariableScene
} from '#tests/helpers/collab/variables'

test('sharing includes variable foundations and live edits survive reconnect and reload', async ({
  browser
}) => {
  const relay = await startRelay()
  let host: Peer | undefined
  let guest: Peer | undefined
  try {
    host = await createPeer(browser, 'Host', relay.url)
    const ids = await seedVariableScene(host.page)
    await host.page.getByTestId('collab-share-button').click()
    await host.page.getByRole('textbox', { name: 'Your name', exact: true }).fill('Host')
    await host.page.getByTestId('collab-share-file').click()
    await expect(host.page).toHaveURL(/\/share\//)
    const roomId = new URL(host.page.url()).pathname.split('/').at(-1)
    if (!roomId) throw new Error('Missing shared room')
    guest = await createPeer(browser, 'Guest', relay.url)
    const hostPage = host.page
    const guestPage = guest.page
    await guestPage.evaluate((id) => window.openPencil?.test?.collab?.connect(id), roomId)
    await expect.poll(async () => (await readVariableScene(guestPage, ids)).variableCount).toBe(3)
    expect((await readVariableScene(guestPage, ids)).collectionIds).toEqual(
      expect.arrayContaining([ids.color, ids.alias, ids.space])
    )

    await changeSharedPadding(hostPage, ids, 24)
    await expect.poll(async () => (await readVariableScene(guestPage, ids)).padding).toBe(24)
    await expect.poll(async () => (await readVariableScene(guestPage, ids)).width).toBe(112)
    const blue = { r: 0.1, g: 0.25, b: 0.8, a: 1 }
    await changeSharedColor(hostPage, ids, blue)
    await expect.poll(async () => (await readVariableScene(guestPage, ids)).color).toEqual(blue)
    await guest.canvas.waitForRender()
    expect(await guest.canvas.screenshotCanvasRegion(450, 300)).toMatchSnapshot(
      'room-variables.png'
    )

    relay.pause()
    await changeSharedPadding(hostPage, ids, 40)
    await renameSharedPadding(guestPage, ids, 'Space/control')
    await expect.poll(() => relay.queuedCount()).toBeGreaterThan(0)
    relay.resume()
    for (const page of [hostPage, guestPage]) {
      await expect
        .poll(async () => {
          const state = await readVariableScene(page, ids)
          return { name: state.name, padding: state.padding }
        })
        .toEqual({ name: 'Space/control', padding: 40 })
    }

    await guestPage.reload()
    await guest.canvas.waitForInit()
    await guestPage.evaluate((id) => window.openPencil?.test?.collab?.connect(id), roomId)
    await expect.poll(async () => (await readVariableScene(guestPage, ids)).padding).toBe(40)
    await guestPage.evaluate((id) => window.openPencil?.getStore?.().removeVariable(id), ids.color)
    await expect.poll(async () => (await readVariableScene(hostPage, ids)).variableCount).toBe(2)
    await guestPage.evaluate(() => window.openPencil?.getStore?.().undo.undo())
    await expect.poll(async () => (await readVariableScene(hostPage, ids)).variableCount).toBe(3)
    expect(collaborationErrors(host)).toEqual([])
    expect(collaborationErrors(guest)).toEqual([])
  } finally {
    await guest?.context.close()
    await host?.context.close()
    await relay.close()
  }
})
