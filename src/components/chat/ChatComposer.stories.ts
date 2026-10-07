import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { ref } from 'vue'
import BotIcon from '~icons/lucide/bot'
import ImagePlusIcon from '~icons/lucide/image-plus'
import MousePointerIcon from '~icons/lucide/mouse-pointer-2'

import type { ACPThinkingSelection } from '@/app/ai/acp/thinking'
import IconButton from '@/components/ui/button/IconButton.vue'
import AppSelect from '@/components/ui/select/AppSelect.vue'
import { chatComposerTheme } from '@/theme/chat/composer'
import { chatProfileTheme } from '@/theme/chat/profile'

import ACPThinkingSelect from './ACPThinkingSelect.vue'
import ChatComposer from './ChatComposer.vue'
import ChatThinkingSelect from './ChatThinkingSelect.vue'

type Args = { width: number; cli: boolean; streaming: boolean }

const meta = {
  title: 'Chat/Composer',
  args: { width: 360, cli: false, streaming: false },
  render: (args) => ({
    components: {
      ChatComposer,
      ChatThinkingSelect,
      ACPThinkingSelect,
      AppSelect,
      IconButton,
      BotIcon,
      ImagePlusIcon,
      MousePointerIcon
    },
    setup() {
      return {
        args,
        model: ref('design'),
        selection: ref<ACPThinkingSelection>(),
        profiles: [{ value: 'design', label: 'Design agent with a longer model name' }],
        control: {
          id: 'thinking',
          name: 'Thinking level',
          currentValue: 'medium',
          options: [
            { value: 'medium', name: 'Medium' },
            { value: 'high', name: 'High' }
          ]
        },
        composerUI: chatComposerTheme(),
        profileUI: chatProfileTheme()
      }
    },
    template: `
      <div class="max-w-full bg-panel" :style="{ width: args.width + 'px' }">
        <ChatComposer :status="args.streaming ? 'streaming' : 'ready'">
          <template #leading>
            <IconButton label="Add selection" size="sm"><MousePointerIcon class="size-3.5" /></IconButton>
            <IconButton label="Attach images" size="sm"><ImagePlusIcon class="size-3.5" /></IconButton>
          </template>
          <template #model>
            <div :class="composerUI.models()">
              <AppSelect v-model="model" label="Design model" :options="profiles"
                :disabled="args.streaming" :ui="{ trigger: profileUI.trigger() }">
                <template #value-start><BotIcon :class="profileUI.triggerIcon()" /></template>
              </AppSelect>
              <ACPThinkingSelect v-if="args.cli" v-model="selection" :control="control"
                :disabled="args.streaming"
                :ui="{ trigger: profileUI.trigger({ class: composerUI.reasoning() }) }" />
              <ChatThinkingSelect v-else />
            </div>
          </template>
        </ChatComposer>
      </div>`
  })
} satisfies Meta<Args>

export default meta
type Story = StoryObj<typeof meta>
export const Default: Story = {}
export const Narrow: Story = { args: { width: 280 } }
export const Wide: Story = { args: { width: 520 } }
export const CLI: Story = { args: { cli: true } }
export const NarrowCLI: Story = { args: { width: 280, cli: true } }
export const Streaming: Story = { args: { streaming: true } }
