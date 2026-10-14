import { enableDesignChecks } from '#tests/helpers/chat/design-checks'
import { expect, test } from '#tests/helpers/chat/fixture'
import { injectToolLoopTransport } from '#tests/helpers/chat/tool-loop'

for (const corrections of [false, true]) {
  test(`automatic design checks retain one reply and enforce corrections=${corrections}`, async ({
    configuredChat: chat,
    page
  }) => {
    await injectToolLoopTransport(page)
    await enableDesignChecks(page, corrections)
    await chat.submit('Create a card.')
    const status = page.getByTestId('chat-run-status')
    await expect(status).toHaveAttribute('data-state', 'finished')
    await expect(status).toContainText('Latest design reviewed')
    await expect(page.getByTestId('chat-message-user')).toHaveCount(1)
    await expect(page.getByTestId('chat-message-assistant')).toHaveCount(1)
    // The scripted model always attempts creation; the final read-only pass must reject it.
    await expect(page.getByRole('treeitem', { name: /^Card Lock Hide$/ })).toHaveCount(
      corrections ? 3 : 1
    )
    await chat.assistantMessage().getByTestId('chat-revert-turn').click()
    await expect(page.getByRole('treeitem', { name: /^Card Lock Hide$/ })).toHaveCount(0)
    await chat.assistantMessage().getByTestId('chat-restore-turn').click()
    await expect(page.getByRole('treeitem', { name: /^Card Lock Hide$/ })).toHaveCount(
      corrections ? 3 : 1
    )
  })
}
