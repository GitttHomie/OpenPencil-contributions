import { params } from '@nanostores/i18n'

import { i18n } from '#vue/i18n/create'

export const filesMessageDefaults = {
  importLabel: 'Import',
  cleanupHeading: 'Clean up embedded components?',
  cleanupIntro: params(
    'Choose how to open “{name}”. Your original file stays unchanged until you save.'
  ),
  cleanupDescription: params(
    'Remove {count} unused definitions from internal canvases. Keep all instances, their required definitions, and components on regular pages.'
  ),
  cleanupInternalHeading: 'Remove internal canvases and linked instances',
  cleanupInternalDescription: params(
    'Remove {canvases} internal canvases and {components} embedded definitions, plus {instances} linked instance layers across {pages} regular pages.'
  ),
  cleanupInternalWarning:
    'This changes your designs, including hidden content and external-library instances. Nested linked layers are removed without deleting their containing buttons or frames. Valid components on regular pages stay.',
  cleanupHiddenInstances: params(
    'Hide {count} nested swapped instances whose replacements are removed, preserving their containing components.'
  ),
  cleanupInternalRemove: 'Remove canvases and linked instances',
  cleanupKeep: 'Keep everything',
  cleanupRemove: 'Remove unused components',
  importHTMLCSS: 'Import HTML/CSS',
  importHTMLCSSDescription: 'Paste HTML plus optional CSS or compiled Tailwind CSS.',
  importFailed: 'Import failed. Check the HTML and CSS, then try again.',
  importReplacesDocument: 'Import replaces the current document.',
  importing: 'Importing…',
  importToCanvas: 'Import to canvas',
  newTab: 'New tab',
  closeTab: params('Close {name}'),
  unsavedChanges: 'Unsaved changes',
  saveBeforeClosing: params('Save changes to “{name}”?'),
  saveBeforeClosingDescription: 'Your changes will be discarded if you close without saving.',
  discard: 'Don’t Save',
  clipboardImageUnavailableWeb:
    'Pasted design includes 1 image that cannot be loaded in the web app. Use the desktop app to include it.',
  clipboardImagesUnavailableWeb: params(
    'Pasted design includes {count} images that cannot be loaded in the web app. Use the desktop app to include them.'
  ),
  clipboardImageFetchFailed:
    'Failed to fetch 1 image from Figma. Check that the source file is accessible and try again.',
  clipboardImagesFetchFailed: params(
    'Failed to fetch {count} images from Figma. Check that the source file is accessible and try again.'
  ),
  recentFiles: 'Recent files',
  recentFilesDescription: 'Continue working on a design or start a new one.',
  noRecentFiles: 'No recent files yet',
  noRecentFilesDescription: 'Files you open in the desktop app will appear here.',
  searchFiles: 'Search files…',
  searchRecentAndStorageFiles: 'Search recent and storage files…',
  newDesign: 'New design',
  noMatchingFiles: params('No files match “{query}”.'),
  saveAsPrompt: 'Save as:',
  browserFileAPINotSupported:
    "Your browser doesn't support the local file API. Files will be downloaded instead of saved in place."
} as const

export const filesMessages = i18n('files', filesMessageDefaults)
