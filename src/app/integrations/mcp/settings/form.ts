import { omit } from 'es-toolkit'
import * as v from 'valibot'
import { useForm } from 'vee-validate'
import { computed, reactive, ref, watch, type Ref } from 'vue'

import {
  createMCPConnectionDraft,
  validateMCPConnectionURL,
  mcpConnectionSettings,
  MCP_CONNECTION_NAME_MAX_LENGTH
} from '@/app/integrations/mcp'
import { requiredSetting, type SettingsValidationMessages } from '@/app/settings/validation/schema'

import type { MCPConnectionDraft } from '../types'

interface ConnectionFormMessages {
  connectionNameInvalid: string
  serverURLHint: string
  bearerTokenRequired: string
}
export type MCPConnectionFieldErrors = Partial<
  Record<'name' | 'url' | 'command' | 'credential', string>
>

/** Only credential availability enters form state, never entered or saved secrets. */
export function useMCPConnectionForm(
  messages: Readonly<Ref<SettingsValidationMessages>>,
  automation: Readonly<Ref<ConnectionFormMessages>>
) {
  const id = ref<MCPConnectionDraft['id']>(null)
  const schema = computed(() =>
    v.pipe(
      v.object({
        name: v.pipe(
          requiredSetting(messages.value.requiredField),
          v.check(
            (name) =>
              name.length <= MCP_CONNECTION_NAME_MAX_LENGTH &&
              name.toLowerCase() !== 'open-pencil' &&
              !mcpConnectionSettings.value.connections.some(
                (connection) =>
                  connection.id !== id.value && connection.name.toLowerCase() === name.toLowerCase()
              ),
            automation.value.connectionNameInvalid
          )
        ),
        url: v.string(),
        transportType: v.picklist(['streamable-http', 'stdio']),
        command: v.string(),
        args: v.array(v.string()),
        autoApprove: v.array(v.string()),
        hasEnvironment: v.boolean(),
        enabled: v.boolean(),
        authenticationType: v.picklist(['none', 'bearer']),
        credential: v.boolean()
      }),
      v.forward(
        v.partialCheck(
          [['url'], ['transportType']],
          (value) => {
            if (value.transportType === 'stdio') return true
            try {
              validateMCPConnectionURL(value.url)
              return true
            } catch {
              return false
            }
          },
          automation.value.serverURLHint
        ),
        ['url']
      ),
      v.forward(
        v.partialCheck(
          [['command'], ['transportType']],
          (value) => value.transportType !== 'stdio' || !!value.command.trim(),
          messages.value.requiredField
        ),
        ['command']
      ),
      v.forward(
        v.partialCheck(
          [['enabled'], ['authenticationType'], ['credential']],
          (value) => !value.enabled || value.authenticationType !== 'bearer' || value.credential,
          automation.value.bearerTokenRequired
        ),
        ['credential']
      )
    )
  )
  const form = useForm({
    initialValues: { ...omit(createMCPConnectionDraft(), ['id']), credential: false },
    validationSchema: schema
  })
  const config = (state: { errors: string[] }) => ({
    validateOnModelUpdate: state.errors.length > 0,
    validateOnChange: false,
    validateOnInput: false
  })
  const [name] = form.defineField('name', config)
  const [url] = form.defineField('url', config)
  const [enabled] = form.defineField('enabled', config)
  const [authenticationType] = form.defineField('authenticationType', config)
  const [transportType] = form.defineField('transportType', config)
  watch(transportType, (value) => {
    if (value === 'stdio') authenticationType.value = 'none'
  })
  const [command] = form.defineField('command', config)
  const [args] = form.defineField('args', config)
  const [autoApprove] = form.defineField('autoApprove', config)
  const [hasEnvironment] = form.defineField('hasEnvironment', config)
  form.defineField('credential', config)
  watch([enabled, authenticationType], () => {
    if (form.errors.value.credential) void form.validateField('credential')
  })
  const fields = reactive({
    id,
    name,
    url,
    enabled,
    authenticationType,
    transportType,
    command,
    args,
    autoApprove,
    hasEnvironment
  })
  const draft = computed<MCPConnectionDraft>({
    get: () => fields,
    set: (values) => {
      id.value = values.id
      form.resetForm({ values: { ...omit(values, ['id']), credential: false } })
    }
  })

  return {
    draft,
    dirty: computed(() => form.meta.value.dirty),
    errors: form.errors,
    blur: (field: 'name' | 'url' | 'command' | 'credential') => form.validateField(field),
    setCredentialReady: (ready: boolean) => form.resetField('credential', { value: ready }),
    handleSubmit: form.handleSubmit,
    isSubmitting: form.isSubmitting
  }
}
