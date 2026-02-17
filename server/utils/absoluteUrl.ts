/**
 * Absolute URL Utility
 *
 * Prepends PUBLIC_BASE_URL or APP_URL env var to a path,
 * ensuring no double slashes.
 */

export function absoluteUrl(path: string): string {
  const base =
    process.env.PUBLIC_BASE_URL ||
    process.env.APP_URL ||
    "http://localhost:3000";

  // Strip trailing slashes from base
  const cleanBase = base.replace(/\/+$/, "");

  // Strip leading slashes from path
  const cleanPath = path.replace(/^\/+/, "");

  // Handle empty path
  if (!cleanPath) {
    return cleanBase;
  }

  return `${cleanBase}/${cleanPath}`;
}
