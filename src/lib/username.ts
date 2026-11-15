/**
 * Public handle rules. Shared by signup and Settings so the two surfaces cannot
 * drift, and pure so tests can call it without a browser.
 */

export const USERNAME_MIN = 3;
export const USERNAME_MAX = 20;

export const RESERVED_USERNAMES = [
  "admin",
  "administrator",
  "kargo",
  "support",
  "seller",
  "buyer",
  "root",
  "help",
  "system",
  "official",
] as const;

const USERNAME_RE = /^[a-z][a-z0-9._]{2,19}$/;

export function normalizeUsername(value: string) {
  return value.trim().toLowerCase();
}

/**
 * Returns a human-readable error, or null when the handle is usable.
 * Uniqueness is not checked here — that needs the database.
 */
export function validateUsername(value: string): string | null {
  const username = normalizeUsername(value);
  if (!username) return "Choose a username.";
  if (username.length < USERNAME_MIN || username.length > USERNAME_MAX)
    return `Use ${USERNAME_MIN}–${USERNAME_MAX} characters.`;
  if (!USERNAME_RE.test(username))
    return "Start with a letter. Use letters, numbers, dot, or underscore only.";
  if (username.includes("..")) return "Use one dot at a time.";
  if (username.endsWith(".")) return "Cannot end with a dot.";
  if ((RESERVED_USERNAMES as readonly string[]).includes(username))
    return "That username is reserved.";
  return null;
}
