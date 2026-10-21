// Rendering-only adapter: actual focus/portal behavior stays in the shared Modal.
import type { ReactNode } from "react";
export default function RenderModal({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section role="dialog" aria-label={title}>
      {children}
    </section>
  );
}
