# KARGO Design Direction

## Visual concept
**Operations cockpit, not marketplace noise.** KARGO should feel dependable and quick to parse: a cool, lightly tinted canvas; warm white surfaces for working areas; deep navy for structure; restrained coral for primary urgency and action; and aqua/green/amber/red only for meaningful status communication.

## Typography
Use **Quicksand** as the single face for the entire product — headings, wayfinding, body copy, labels, forms, tables, and high-value numeric readouts — with **DM Sans** as the fallback while the webfont loads. The rounded geometric forms keep the operational surfaces warm without making them feel decorative. Avoid default system stacks and avoid mixing in display faces.

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

## Admin console
The admin back office is the same product, not a second design system. It reuses the shell, cards, tables, buttons, badges, modals, spacing, and type of the buyer/seller app — only the tab set and a quiet "Admin console" chip in the header change. The admin's five tabs are **Dashboard, Users, Batches, Transactions, Security**; personal profile and password live behind the avatar menu, keeping the governance tabs focused on operations.

Admin status, role, and moderation are communicated with pill badges (text + shape + tone, never color alone): active/suspended, buyer/seller/admin, and visible/flagged/hidden. Destructive actions (suspend, revoke, cancel, override, hide, close) always route through a confirmation that requires a written reason and, for the most consequential ones, typing the target's name; every such action is written to an immutable audit log. Tables stay horizontally scrollable on small screens rather than collapsing, lists always show loading/empty/error states, feedback is inline (no browser alerts), and reduced-motion is respected. Money is shown role-aware: sellers see what they sold, buyers see what they spent.
