import type { Meta, StoryObj } from '@storybook/vue3-vite'

import AppButton from '@/components/ui/button/AppButton.vue'

import AppSpinner from './AppSpinner.vue'

const meta = {
  title: 'Design System/Spinner',
  component: AppSpinner,
  render: () => ({
    components: { AppSpinner, AppButton },
    template: `
      <div class="flex flex-col gap-6 bg-panel p-6 text-surface">
        <div class="flex items-center gap-6">
          <AppSpinner class="size-3" />
          <AppSpinner class="size-3.5" />
          <AppSpinner class="size-4" />
          <AppSpinner class="size-8" />
        </div>
        <div class="flex items-center gap-6">
          <AppButton loading size="xs">Loading</AppButton>
          <AppButton loading size="sm">Loading</AppButton>
          <AppButton loading size="md">Loading</AppButton>
        </div>
        <div class="flex items-center gap-2 text-xs">
          <AppSpinner />
          <span>Working</span>
        </div>
      </div>`
  })
} satisfies Meta<typeof AppSpinner>

export default meta
type Story = StoryObj<typeof meta>
export const SizesAndContexts: Story = {}
