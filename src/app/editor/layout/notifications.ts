import type { Editor, LayoutSizingConversion } from '@open-pencil/core/editor'

import { notificationMessages } from '@/app/i18n/notifications'
import { toast } from '@/app/shell/ui'

export function notifyLayoutSizingConversion(conversion: LayoutSizingConversion) {
  const messages = notificationMessages.get()
  const name = conversion.containerName
  if (conversion.kind === 'container') {
    const message =
      conversion.axis === 'width'
        ? messages.layoutContainerFixedWidth
        : messages.layoutContainerFixedHeight
    toast.info(message({ name, layer: conversion.layerName }))
  } else if (conversion.count === 1) {
    const message =
      conversion.axis === 'width' ? messages.layoutLayerFixedWidth : messages.layoutLayerFixedHeight
    toast.info(message({ name }))
  } else {
    const message =
      conversion.axis === 'width'
        ? messages.layoutLayersFixedWidth
        : messages.layoutLayersFixedHeight
    toast.info(message({ name, count: conversion.count }))
  }
}

export function bindLayoutNotifications(editor: Editor) {
  return editor.onEditorEvent('layout:sizing-converted', notifyLayoutSizingConversion)
}
