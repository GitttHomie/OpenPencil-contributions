// Headless only: `./stylesheet` loads this module lazily where the browser's parser is missing.
// The package's browser field points at a global script, not an importable module.
// Select the CommonJS parser explicitly so bundlers can also build this lazy fallback.
import { parse } from '@acemir/cssom/lib/parse.js'

import { createTokenValidator } from './validate'

export const tokenValidator = createTokenValidator(parse)
