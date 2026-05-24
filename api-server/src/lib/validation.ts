/**
 * Returns true when value is null, undefined, an empty string, a relative
 * path beginning with "/" (but not "//"), or an http(s):// URL. Used to
 * reject "javascript:" and "data:" URLs in user-supplied content.
 */
export function isSafeUrl(value: unknown): boolean {
  if (value === null || value === undefined || value === "") return true;
  if (typeof value !== "string") return false;
  const trimmed = value.trim();
  if (trimmed === "") return true;
  if (trimmed.startsWith("/") && !trimmed.startsWith("//")) return true;
  try {
    const u = new URL(trimmed);
    return u.protocol === "https:" || u.protocol === "http:";
  } catch {
    return false;
  }
}

/**
 * Validates each named field in body with isSafeUrl. Returns the offending
 * field name on failure, or null when all fields pass.
 */
export function validateUrlFields(
  body: Record<string, unknown> | null | undefined,
  fields: readonly string[],
): string | null {
  if (!body) return null;
  for (const field of fields) {
    if (field in body && !isSafeUrl(body[field])) {
      return `${field} must be a relative path starting with "/" or an http(s) URL`;
    }
  }
  return null;
}
