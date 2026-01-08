// Admin authorization helper
// Prevents accidental data exposure by requiring explicit admin allowlist

/**
 * Read and parse ADMIN_EMAILS from env at runtime.
 * Returns empty array if not configured.
 * Reading at runtime (not module load) prevents cache issues in tests/serverless/hot-reload.
 */
function getAdminEmails(): string[] {
  const raw = process.env.ADMIN_EMAILS;
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * Assert that the given email is in the admin allowlist.
 * Fails closed: throws if ADMIN_EMAILS is not configured or email is not allowlisted.
 * 
 * @throws {Error} "ADMIN_EMAILS is not set; admin access disabled" if allowlist is empty
 * @throws {Error} "Forbidden" if email is missing or not in allowlist
 */
export function assertAdminEmail(email: string | null | undefined): asserts email is string {
  const admins = getAdminEmails();
  
  if (admins.length === 0) {
    throw new Error("ADMIN_EMAILS is not set; admin access disabled");
  }

  const normalized = (email ?? "").trim().toLowerCase();
  
  if (!normalized || !admins.includes(normalized)) {
    throw new Error("Forbidden");
  }
}
