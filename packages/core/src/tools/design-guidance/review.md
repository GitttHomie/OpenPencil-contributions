# Design review

Review the requested surface against the user's goal and its existing design decisions. Inspect relevant nodes and actual rendered output. A structurally valid tree can still look wrong; a polished screenshot can still contain duplicated components and unbound tokens.

Check three dimensions separately:

- Visual: hierarchy, typography, spacing, alignment, imagery, contrast, and fidelity to the requested direction.
- UX: clarity of the primary task, labels, state feedback, recovery, content ranges, and relevant narrow-layout behavior.
- Structure: variable bindings, linked instances, appropriate variants/properties, content layout, and preservation of unrelated work.

Use `describe` and available graph inspection tools to locate concrete problems. Check fonts before diagnosing text geometry. Verify intended clipping and overlays rather than treating every overlap as a defect. Decorative raw values and one-off artwork need not become tokens or components.

When text overlaps a photo, inspect the frame's actual fills and rendered contrast. A requested scrim must exist as a visible solid or gradient fill above the image; check alpha and direction. Agent reasoning or a layer name is not evidence that the fill was created.

For each material finding, name the affected node or region, the observed problem, its consequence, and a specific correction. Separate observed defects from assumptions or suggestions. Do not invent research, claim a subjective score proves usability, or declare WCAG compliance from a screenshot.

For creation or requested fixes, inspect once, batch justified corrections, and confirm the affected result. Continue only for a concrete unresolved defect. For a review-only request, report findings without modifying the document. Keep summaries short and prioritize issues that affect the primary task.

State what could not be checked. A canvas cannot establish runtime keyboard navigation, screen-reader announcements, motion behavior, or successful backend actions. Missing image or vision capabilities should produce an honest limitation, not a fabricated visual review.
