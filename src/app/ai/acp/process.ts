import { decodeTauriStderr } from '@/app/shell/ui'

import { startAgentProcess } from './process-start'

export type TauriChild = {
  write(data: number[]): Promise<void>
  kill(): Promise<void>
}

type ACPProcessOptions = {
  command: string
  args: string[]
  env?: Record<string, string>
  logId: string
  destroying: () => boolean
  onUnexpectedClose: () => void
}

export async function spawnACPProcess({
  command: commandName,
  args,
  env,
  logId,
  destroying,
  onUnexpectedClose
}: ACPProcessOptions) {
  const stdoutChunks: Uint8Array[] = []
  let stdoutResolver: ((chunk: Uint8Array | null) => void) | null = null
  let stdoutClosed = false
  let stdoutClosedError: Error | null = null

  const stdout = (raw: Uint8Array | number[]) => {
    const chunk = raw instanceof Uint8Array ? raw : new Uint8Array(raw)
    if (stdoutResolver) {
      const resolve = stdoutResolver
      stdoutResolver = null
      resolve(chunk)
    } else {
      stdoutChunks.push(chunk)
    }
  }

  const stderr = (raw: Uint8Array | number[] | string) => {
    console.error(`[ACP ${logId}]`, decodeTauriStderr(raw))
  }

  const close = () => {
    stdoutClosed = true
    stdoutClosedError = destroying() ? null : new Error('Agent process exited unexpectedly.')
    if (stdoutResolver) {
      const resolve = stdoutResolver
      stdoutResolver = null
      resolve(null)
    }
    if (!destroying()) {
      onUnexpectedClose()
    }
  }

  const child = await startAgentProcess({ command: commandName, args, env, stdout, stderr, close })

  const output = new ReadableStream<Uint8Array>({
    async pull(controller) {
      const buffered = stdoutChunks.shift()
      if (buffered) {
        controller.enqueue(buffered)
        return
      }
      if (stdoutClosed) {
        if (stdoutClosedError) controller.error(stdoutClosedError)
        else controller.close()
        return
      }
      const chunk = await new Promise<Uint8Array | null>((resolve) => {
        stdoutResolver = resolve
      })
      if (chunk) {
        controller.enqueue(chunk)
        return
      }
      if (stdoutClosedError) controller.error(stdoutClosedError)
      else controller.close()
    }
  })

  const input = new WritableStream<Uint8Array>({
    async write(chunk) {
      await child.write(Array.from(chunk))
    }
  })

  return { child, input, output }
}
