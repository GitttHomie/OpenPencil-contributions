import { useResizeObserver } from '@vueuse/core'
import type { CanvasKit } from 'canvaskit-wasm'
import type { Ref } from 'vue'

type ResizeObserverOptions = {
  canvasRef: Ref<HTMLCanvasElement | null>
  getCanvasKitValue: () => CanvasKit | null
  resizeCanvas: (canvas: HTMLCanvasElement) => void
}

export function useCanvasResizeObserver({
  canvasRef,
  getCanvasKitValue,
  resizeCanvas
}: ResizeObserverOptions) {
  let resizeRaf = 0

  function cancelResize() {
    cancelAnimationFrame(resizeRaf)
    resizeRaf = 0
  }

  useResizeObserver(canvasRef, () => {
    const canvas = canvasRef.value
    if (!canvas || !getCanvasKitValue() || resizeRaf) return
    resizeRaf = requestAnimationFrame(() => {
      resizeRaf = 0
      if (canvasRef.value !== canvas) return
      const dpr = window.devicePixelRatio || 1
      if (
        canvas.width === Math.floor(canvas.clientWidth * dpr) &&
        canvas.height === Math.floor(canvas.clientHeight * dpr)
      )
        return
      resizeCanvas(canvas)
    })
  })

  return { cancelResize }
}
