# UX and interaction

Infer who uses this surface, what they are trying to do, and what success looks like. Use the supplied context; a short request is sufficient to begin. Treat unverified assumptions as assumptions, not research findings or invented user testimony.

For a flow, work through entry, primary action, feedback, completion, and recovery before choosing the screens. Include relevant empty, loading, error, permission, and success states within the requested scope. A small control edit does not require a flow diagram or a new set of screens.

Make the next action discoverable. Use familiar controls, clear labels, and a hierarchy that reflects task importance. Keep related information and actions together. Show useful defaults and reveal secondary options when needed; do not hide essential information to make the screen look cleaner.

Design errors with a recovery action and preserve the user's input. Put field guidance near the field, avoid placeholder-only labels, and avoid noisy validation while someone is still typing. Allow cancellation or reversal where appropriate. Explain unavailable actions when the reason would otherwise be unclear.

Use realistic content ranges: long names, missing images, empty results, multiple items, and large values. Test what matters for this task rather than producing every possible state. Narrow layouts may need a different information hierarchy, not just smaller text.

Design visible focus and selected states, readable contrast, meaningful control labels, and alternatives to color-only or gesture-only communication. Consider touch targets and safe areas for the intended platform. A canvas design can specify these behaviors; it cannot prove keyboard operation, screen-reader semantics, server validation, or real usability. Identify those implementation checks separately.
