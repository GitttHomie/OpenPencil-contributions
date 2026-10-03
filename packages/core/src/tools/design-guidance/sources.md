# Design guidance sources

Pack version: 1.0.0. Reviewed 2026-10-02.

The Markdown modules are original OpenPencil guidance informed by the references below. They do not bundle upstream skill text, scripts, installers, templates, or rule databases. The pack uses OpenPencil tools and its canonical design-JSX reference, makes planning artifacts optional, and distinguishes canvas checks from runtime verification.

| Reference                                                                                                                                                  | Reviewed revision                          | Use                                                                                 |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ | ----------------------------------------------------------------------------------- |
| [Impeccable](https://github.com/pbakaus/impeccable/tree/508d7e8955de3b3caf2d8676e85206723d41a887)                                                          | `508d7e8955de3b3caf2d8676e85206723d41a887` | Context-sensitive product design, flow planning, extraction, hardening, and review. |
| [Taste Skill](https://github.com/Leonxlnx/taste-skill/tree/ce26fc25c0e5e8cab638f883de62d9a86ee5e45b)                                                       | `ce26fc25c0e5e8cab638f883de62d9a86ee5e45b` | Audience-led visual direction and preservation of identity during refinement.       |
| [Anthropic frontend-design](https://github.com/anthropics/skills/tree/8a1541c4a3ffa5a20a5a91de0dcf3f0bab1d1ef4/skills/frontend-design)                     | `8a1541c4a3ffa5a20a5a91de0dcf3f0bab1d1ef4` | Typography, composition, content, and visual specificity.                           |
| [Design-system-patterns](https://github.com/wshobson/agents/tree/156b7a5e7a8b93642628a339ee4039c925b34c7f/plugins/ui-design/skills/design-system-patterns) | `156b7a5e7a8b93642628a339ee4039c925b34c7f` | Semantic tokens and component organization.                                         |
| [Nielsen Norman Group usability heuristics](https://www.nngroup.com/articles/ten-usability-heuristics/)                                                    | Accessed 2026-10-02                        | Status, consistency, user control, recognition, and error recovery.                 |
| [GOV.UK validation](https://design-system.service.gov.uk/patterns/validation/)                                                                             | Accessed 2026-10-02                        | Contextual field guidance and validation timing.                                    |
| [W3C target size](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html)                                                                    | Accessed 2026-10-02                        | Distinguishing accessibility criteria from blanket size recommendations.            |

Changes to the pack should follow observed design outcomes and supported capabilities. Review upstream revisions before incorporating new guidance; do not load mutable remote instructions during design sessions. If upstream material is vendored in a future revision, preserve its applicable license and notices.
