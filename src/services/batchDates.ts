/** "Oct 1–15, 2026" — the public date range for a batch. */
export function formatBatchDateRange(startsOn: string, endsOn: string) {
  const start = new Date(`${startsOn}T00:00:00`)

  const end = new Date(`${endsOn}T00:00:00`)

  const startMonth = start.toLocaleDateString("en-US", { month: "short" })

  const endMonth = end.toLocaleDateString("en-US", { month: "short" })

  const startYear = start.getFullYear()

  const endYear = end.getFullYear()

  if (startMonth === endMonth && startYear === endYear) {
    return `${startMonth} ${start.getDate()}–${end.getDate()}, ${endYear}`
  }

  if (startYear === endYear) {
    return `${startMonth} ${start.getDate()}–${endMonth} ${end.getDate()}, ${endYear}`
  }

  return `${startMonth} ${start.getDate()}, ${startYear}–${endMonth} ${end.getDate()}, ${endYear}`
}
