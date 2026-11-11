// Merge a freshly loaded page into the rows already shown.
//
// The first page replaces; later pages append. We de-duplicate by id so a page
// can never add the same row twice — guarding against React re-running the
// append effect (e.g. Strict Mode) and against a backend that returns a row on
// two pages when its sort key has ties. The backend tiebreaker fixes the latter
// at the source; this keeps the UI correct even if that migration isn't applied.
export function appendPage<T extends { id: string }>(prev: T[], page: T[], offset: number): T[] {
  if (offset === 0) return page;
  const seen = new Set(prev.map((row) => row.id));
  return [...prev, ...page.filter((row) => !seen.has(row.id))];
}
