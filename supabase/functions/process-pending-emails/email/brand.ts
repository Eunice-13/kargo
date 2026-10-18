// KARGO transactional email design tokens.
//
// Mirrors src/constants/theme.ts (indigo #191BA9, cream #F7F3F3, coral #FF8A65,
// sky #5CC2F2, green #3FBF8F, amber #FFC24B) so an email never drifts from the
// app it belongs to. Values are duplicated rather than imported because the
// Edge Function runs in Deno and cannot resolve the app's `@/` alias.

export type Tone = "neutral" | "info" | "success" | "warning" | "danger" | "brand"

export const COLOR = {
  indigo: "#191BA9",
  indigoDeep: "#12146F",
  cream: "#F7F3F3",
  surface: "#FFFFFF",
  cyanL: "#DEF3FA",
  sky: "#5CC2F2",
  coral: "#FF8A65",
  green: "#3FBF8F",
  amber: "#FFC24B",
  ink: "#17212B",
  soft: "#41515F",
  muted: "#748391",
  mutedText: "#5B6B79",
  hairline: "#E7EBEF",
  hairlineSoft: "#EEF1F4",
} as const

export const DARK = {
  canvas: "#0F1319",
  surface: "#171C26",
  ink: "#EEF2F6",
  soft: "#C3CDD8",
  muted: "#93A1B0",
  hairline: "#2A3240",
  hairlineSoft: "#232B38",
  cream: "#1B212C",
} as const

export const TONES: Record<Tone, { bg: string; ink: string; accent: string }> = {
  neutral: { bg: "#F3F4F6", ink: "#41515F", accent: "#9CA3AF" },
  info: { bg: "#DEF3FA", ink: "#0B4C63", accent: "#5CC2F2" },
  success: { bg: "#D4F5EA", ink: "#0B6B4E", accent: "#3FBF8F" },
  warning: { bg: "#FEF3C7", ink: "#8A4B06", accent: "#FFC24B" },
  danger: { bg: "#FEE2E2", ink: "#8F1D1D", accent: "#EF4444" },
  brand: { bg: "#EDEDFB", ink: "#191BA9", accent: "#191BA9" },
}

// Manrope is the app's wayfinding and numeric voice, DM Sans its reading voice.
// Both are declared as webfonts but every stack falls back to a humanist system
// face, because Gmail and Outlook routinely decline to fetch them.
export const FONT = {
  display: "'Manrope','DM Sans','Segoe UI',Helvetica,Arial,sans-serif",
  body: "'DM Sans','Segoe UI',Helvetica,Arial,sans-serif",
  mono: "'DM Sans','Segoe UI',Helvetica,Arial,sans-serif",
} as const

export const METRICS = {
  width: 600,
  radius: 16,
  radiusSmall: 10,
  gutter: 32,
  gutterMobile: 20,
} as const
