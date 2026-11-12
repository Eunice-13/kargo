/** "Oct 1–15, 2026" — the public date range for a batch. */

function parseBatchDay(value: string | null | undefined) {
  if (!value) return null

  const date = new Date(`${value}T00:00:00`)

  return Number.isNaN(date.getTime()) ? null : date
}

function formatSingleDay(date: Date) {
  const month = date.toLocaleDateString("en-US", { month: "short" })

  return `${month} ${date.getDate()}, ${date.getFullYear()}`
}

export function formatBatchDateRange(startsOn: string, endsOn: string) {
  const start = parseBatchDay(startsOn)

  const end = parseBatchDay(endsOn)

  // A batch can be saved with a start date but no usable end date yet. Show the
  // start day on its own instead of leaking "Invalid Date" into the card.
  if (!start) return end ? formatSingleDay(end) : ""

  if (!end) return formatSingleDay(start)

  const startMonth = start.toLocaleDateString("en-US", { month: "short" })

  const endMonth = end.toLocaleDateString("en-US", { month: "short" })

  const startYear = start.getFullYear()

  const endYear = end.getFullYear()

  // A one-day batch ("Apr 22, 2027") reads better than "Apr 22–22, 2027".
  if (
    startYear === endYear &&
    startMonth === endMonth &&
    start.getDate() === end.getDate()
  ) {
    return formatSingleDay(start)
  }

  if (startMonth === endMonth && startYear === endYear) {
    return `${startMonth} ${start.getDate()}–${end.getDate()}, ${endYear}`
  }

  if (startYear === endYear) {
    return `${startMonth} ${start.getDate()}–${endMonth} ${end.getDate()}, ${endYear}`
  }

  return `${startMonth} ${start.getDate()}, ${startYear}–${endMonth} ${end.getDate()}, ${endYear}`
}
