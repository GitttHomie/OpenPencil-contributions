# Design review

Review the requested surface against the user's goal and its existing design decisions. Inspect relevant nodes and actual rendered output. A structurally valid tree can still look wrong; a polished screenshot can still contain duplicated components and unbound tokens.

Check three dimensions separately:

- Visual: hierarchy, typography, spacing, alignment, imagery, contrast, and fidelity to the requested direction.
- UX: clarity of the primary task, labels, state feedback, recovery, content ranges, and relevant narrow-layout behavior.
- Structure: variable bindings, linked instances at multiple levels, appropriate variants/properties, content layout, and preservation of unrelated work. Trace shared controls inside larger components back to their main definitions, then check that screens use those larger components. Look for manually rebuilt controls, unused component boards, and separate definitions that differ only in content; report these as reuse candidates rather than assuming every similar-looking region should be merged.

Use `describe` and available graph inspection tools to locate concrete problems. Check fonts before diagnosing text geometry. Verify intended clipping and overlays rather than treating every overlap as a defect. Decorative raw values and one-off artwork need not become tokens or components.

Inspect newly created or changed main components and their sets as well as the screens using them. Check that variants do not overlap and that definition containers enclose their contents. Resolve `component-overlap` and `component-overflow` render feedback using the existing node IDs; a screenshot of the screens alone does not verify their definitions.

When text overlaps a photo, inspect the frame's actual fills and rendered contrast. A requested scrim must exist as a visible solid or gradient fill above the image; check alpha and direction. Agent reasoning or a layer name is not evidence that the fill was created.

For each material finding, name the affected node or region, the observed problem, its consequence, and a specific correction. Separate observed defects from assumptions or suggestions. Do not invent research, claim a subjective score proves usability, or declare WCAG compliance from a screenshot.

For creation or requested fixes, inspect once, batch justified corrections, and confirm the affected result. Continue only for a concrete unresolved defect. For a review-only request, report findings without modifying the document. Keep summaries short and prioritize issues that affect the primary task.

After the last edit, export the entire requested screen, then any detail too small to judge in that image. A detail export alone does not verify the whole page. Use `analyze_spacing` on the screen to check combined section whitespace, clipping and overlap against the rendered image; do not impose a universal grid. Any further correction invalidates the previous preview of the changed region, so verify it again before calling the work complete. Check that library sample text, image placeholders, and unrelated product claims have been replaced or clearly identified as unfinished. A stopped run with failed edits is incomplete even when its initial layout rendered successfully.

State what could not be checked. A canvas cannot establish runtime keyboard navigation, screen-reader announcements, motion behavior, or successful backend actions. Missing image or vision capabilities should produce an honest limitation, not a fabricated visual review.
