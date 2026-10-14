---
title: Evaluating design guidance
description: Compare visual, UX, structural, and interaction outcomes from OpenPencil design agents.
---

# Evaluating design guidance

The bundled workflow is in `packages/core/src/tools/design-guidance/`. It is composed into direct chat, ACP, and harness instructions; detailed topics are retrieved through `get_design_guidance`. The pack's `sources.md` records the references used to develop its original OpenPencil guidance.

Atomic composition means the delivered screens reuse linked components at useful levels: a card's button references the shared Button definition, and screens reference Card instances with their own content. Bound tokens support those components. JSX helper functions, copied frames and unused component boards do not establish this structure. The compact composition reminder is also included on ACP continuation turns; the full workflow and authoring reference remain first-turn instructions.

Briefs, PRDs, questionnaires, and stage approvals are optional. The evaluation should treat an unnecessary demand for those artifacts as a workflow failure.

## Repeatable comparisons

Compare the previous release or checkout against the candidate using the same model, settings, starting document, prompt, viewport, and tool budget. For a guidance-only comparison, hold tool availability constant as well. Record tool-default changes separately when comparing the complete feature.

Use at least three runs per case to distinguish recurring behavior from a single generation. Save the resulting documents, rendered images, model/provider identity, tool transcript, time, usage, and unresolved errors in ignored `scratch/`. Use isolated documents; never run the corpus against the user's working design.

| Case | Starting document | Prompt | Assess |
| --- | --- | --- | --- |
| New product flow | Empty | Design a mobile appointment booking flow for a neighborhood bike repair shop: pick a service and time, enter details, and confirm. Make reasonable assumptions and just design it. | Primary task, relevant validation/recovery states, variables before consumers, shared controls and linked instances. |
| Dense product UI | Empty | Design a desktop inventory screen for a bike shop with search, filters, stock levels, and low-stock actions. Keep it practical and readable. | Information hierarchy, useful density, understandable actions, relevant empty/results states, component reuse. |
| Visual identity | Empty | Design a playful landing page for a neighborhood bike repair shop using cobalt blue, warm yellow, and bold sans-serif typography. | Brief fidelity, distinctive composition, readable type, meaningful copy, no imposed conflicting aesthetic. |
| Existing library | Document containing bound Button and Card components | Add a repair-service selection screen using the existing design system. | Reuse of original component IDs and tokens, appropriate overrides, preservation of existing work. |
| Nested reuse and continuation | Empty, then continue the same chat | Design service results and a booking summary with shared service cards, status badges and booking buttons. Give each service distinct content. Then: make the shared booking button more rounded and add another service. | Card consumers contain linked Button/Badge instances; spacing is bound; the continuation reuses original definitions; changing Button reaches nested consumers and preserves card content. |
| Small edit | Document containing a button instance | Change this button's label to “Book a repair”. | Direct completion without questionnaires, new foundations, unrelated redesign, or detachment. |
| Content and resize | Document containing a form and card instances | Make this work at a narrow mobile width and with long service names. | Wrapping, Hug/Fill, meaningful constraints, preserved instances, no clipping used to conceal errors. |
| Review only | Document with a known overflow and an unlabeled control | Review this screen's design and UX. Don't change it. | Specific evidence and consequences, no mutation, no invented runtime verification. |
| Optional planning | Empty | Create a compact repair-booking screen. No brief, PRD, or approval rounds. | Useful completion from the request, reasonable assumptions, no demand for extra documents. |

For seeded cases, save a single fixture document before the comparison and reuse it for every run. Record which tokens and components already exist, and introduce known defects only in the review case.

## Assess independently

Have a reviewer compare anonymized rendered results for visual quality and usefulness. Inspect the underlying documents separately; visual preference alone cannot establish structural quality.

- **Visual:** hierarchy, typography, spacing, contrast, composition, and fidelity to the request.
- **UX:** task clarity, labels, appropriate states, feedback, and recovery. Mark behavior that needs a runnable implementation as unverified.
- **Structure:** actual variable bindings, appropriate component identity, nested linked instances, variants/properties, and layout behavior. Trace representative screen → pattern → control → definition relationships; inspect repeated UI beyond the easiest button, unnecessary content-only variants, and unused definitions.
- **Change propagation:** in a copy of the result, edit a shared token and main component; check their consumers while preserving instance overrides.
- **Robustness:** narrow widths, longer content, available fonts, and save/reopen preservation.
- **Interaction cost:** unnecessary questions, requested planning artifacts, unauthorized scope expansion, tool errors, calls, usage, and elapsed time.

Record concrete defects and observations rather than presenting an AI-generated aggregate score as measured usability. A missing image service or visual-input capability is a limitation to record, not evidence that visual review succeeded.

## Automated coverage

`packages/core/tests/tools/design-guidance/` exercises topic discovery, validation, selective retrieval, and variable → component → nested instance → screen workflows, including content overrides and shared edits. Chat transport tests check delivered instructions and tool overrides; ACP tests check instruction delivery on initial and continuation turns; MCP tests exercise retrieval through the protocol.

These tests establish integration and authoring contracts. They do not demonstrate that a model follows the guidance or that users prefer its designs. Run the comparative corpus when changing the guidance materially, and retain that distinction in release reports.
