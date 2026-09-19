# KARGO Design Direction

## Visual concept
**Operations cockpit, not marketplace noise.** KARGO should feel dependable and quick to parse: a cool, lightly tinted canvas; warm white surfaces for working areas; deep navy for structure; restrained coral for primary urgency and action; and aqua/green/amber/red only for meaningful status communication.

## Typography
Use **Manrope** for headings, wayfinding, and high-value numeric readouts. Use **DM Sans** for body copy, labels, forms, and dense tables. Avoid default system stacks and avoid using a display face for long paragraphs.

## Color roles
| Role | Token | Use |
|---|---|---|
| Ink | `#17212B` | Headings, amounts, primary text |
| Soft ink | `#41515F` | Body copy and table values |
| Muted | `#748391` | Supporting labels and metadata |
| Canvas | `#F5F7F8` | App background |
| Surface | `#FFFFFF` | Working areas and cards |
| Navy | `#18324A` | Brand and navigation anchor |
| Blue | `#246B8F` | Links and informational affordances |
| Coral | `#D85B4D` | Primary action and active underline |
| Aqua | `#DFF2F0` | Calm informational state |

## Layout and interaction rules
Use one clear page-level hierarchy. Prefer a surface over a nested card when a section already has an established boundary. Keep sticky header/navigation chrome visually quiet so the active task remains dominant. Use hover for affordance, not decoration; use focus-visible outlines for keyboard navigation; never rely on color alone to communicate a state. Respect reduced-motion preferences and keep tables horizontally scrollable on small screens.

## Applied pass
The current pass updates the global shell, typography, motion, focus behavior, responsive behavior, scrollbar treatment, and design documentation while preserving the existing product flows and data model. The top navigation now includes the already-implemented Reports destination alongside Dashboard, Batches, My Claims, and Payments.
