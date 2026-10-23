/** Batch dates are Philippine calendar dates, independent of the browser timezone. */
export function batchFormationDeadline(endsOn: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(endsOn)) throw new Error("Invalid batch end date");
  const deadline = new Date(`${endsOn}T23:59:59+08:00`);
  if (!Number.isFinite(deadline.getTime())) throw new Error("Invalid batch end date");
  return deadline.toISOString();
}

export function formationExpired(status: string, deadline: string, now = Date.now()): boolean {
  return status === "forming" && new Date(deadline).getTime() <= now;
}

export function formatFormationDeadline(deadline: string): string {
  return (
    new Intl.DateTimeFormat("en-PH", {
      dateStyle: "medium",
      timeStyle: "medium",
      timeZone: "Asia/Manila",
    }).format(new Date(deadline)) + " (Philippine time · Asia/Manila)"
  );
}
