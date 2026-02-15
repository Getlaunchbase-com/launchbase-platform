/**
 * Input Sanitization & CSRF Protection
 *
 * Defense-in-depth utilities for request validation:
 *
 * 1. Script injection detection (XSS patterns in free-text fields)
 * 2. SQL injection pattern detection
 * 3. Origin/Referer-based CSRF protection for mutations
 * 4. Content-type validation
 *
 * These are secondary defenses — Zod schemas + parameterized queries
 * are the primary protection. This layer catches unusual patterns
 * that slip past normal validation and logs them for review.
 */

import { TRPCError } from "@trpc/server";

// ---------------------------------------------------------------------------
// XSS pattern detection
// ---------------------------------------------------------------------------

/**
 * Patterns that indicate script injection attempts.
 * These are intentionally broad to catch obfuscated payloads.
 */
const XSS_PATTERNS = [
  /<script\b/i,
  /javascript\s*:/i,
  /on(load|error|click|mouseover|focus|blur)\s*=/i,
  /<iframe\b/i,
  /<object\b/i,
  /<embed\b/i,
  /<svg\b[^>]*\bon/i,
  /data\s*:\s*text\/html/i,
  /\beval\s*\(/i,
  /document\.(cookie|location|write)/i,
  /window\.(location|open)/i,
] as const;

/**
 * Check if a string contains suspicious XSS-like patterns.
 * Returns the matched pattern name or null if clean.
 */
export function detectXssPattern(input: string): string | null {
  for (const pattern of XSS_PATTERNS) {
    if (pattern.test(input)) {
      return pattern.source;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// SQL injection pattern detection
// ---------------------------------------------------------------------------

/**
 * Common SQL injection patterns.
 * Not a replacement for parameterized queries — these catch obvious
 * injection attempts in free-text fields for logging/alerting.
 */
const SQLI_PATTERNS = [
  /('\s*(OR|AND)\s+')/i,
  /(;\s*(DROP|DELETE|UPDATE|INSERT|ALTER|CREATE)\s+)/i,
  /(UNION\s+(ALL\s+)?SELECT)/i,
  /(--\s*$)/m,
  /(\b(EXEC|EXECUTE)\s*\()/i,
] as const;

/**
 * Check if a string contains SQL injection patterns.
 * Returns the matched pattern name or null if clean.
 */
export function detectSqlInjection(input: string): string | null {
  for (const pattern of SQLI_PATTERNS) {
    if (pattern.test(input)) {
      return pattern.source;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Deep scan for objects
// ---------------------------------------------------------------------------

/**
 * Recursively scan all string values in an object for suspicious patterns.
 * Returns an array of findings (empty = clean).
 */
export function scanInput(
  obj: unknown,
  path = ""
): Array<{ path: string; type: "xss" | "sqli"; pattern: string }> {
  const findings: Array<{ path: string; type: "xss" | "sqli"; pattern: string }> = [];

  if (typeof obj === "string") {
    const xss = detectXssPattern(obj);
    if (xss) findings.push({ path, type: "xss", pattern: xss });

    const sqli = detectSqlInjection(obj);
    if (sqli) findings.push({ path, type: "sqli", pattern: sqli });
  } else if (Array.isArray(obj)) {
    obj.forEach((item, idx) => {
      findings.push(...scanInput(item, `${path}[${idx}]`));
    });
  } else if (obj && typeof obj === "object") {
    for (const [key, value] of Object.entries(obj)) {
      findings.push(...scanInput(value, path ? `${path}.${key}` : key));
    }
  }

  return findings;
}

// ---------------------------------------------------------------------------
// CSRF protection
// ---------------------------------------------------------------------------

/**
 * Validate that the request origin matches the expected app origin.
 * For mutation requests only — safe methods (GET) are exempt.
 *
 * Returns true if the origin is valid, false if suspicious.
 */
export function validateOrigin(req: {
  method?: string;
  headers?: Record<string, string | string[] | undefined>;
}): boolean {
  // Only check mutations
  if (req.method === "GET" || req.method === "HEAD" || req.method === "OPTIONS") {
    return true;
  }

  const origin = req.headers?.origin as string | undefined;
  const referer = req.headers?.referer as string | undefined;

  // No origin/referer on same-origin requests in some browsers — allow
  if (!origin && !referer) {
    return true;
  }

  const allowedOrigins = getAllowedOrigins();

  if (origin && allowedOrigins.some((allowed) => origin.startsWith(allowed))) {
    return true;
  }

  if (referer && allowedOrigins.some((allowed) => referer.startsWith(allowed))) {
    return true;
  }

  return false;
}

function getAllowedOrigins(): string[] {
  const origins: string[] = [
    "http://localhost",
    "https://localhost",
  ];

  // App URL from environment
  const appUrl = process.env.PUBLIC_BASE_URL || process.env.APP_URL;
  if (appUrl) {
    origins.push(appUrl);
  }

  // Manus space domains
  origins.push("https://launchbase-h86jcadp.manus.space");

  return origins;
}

// ---------------------------------------------------------------------------
// Content-type validation
// ---------------------------------------------------------------------------

/**
 * Verify that POST/PUT/PATCH requests have an appropriate content type.
 * Blocks requests with unexpected content types (e.g., text/plain CSRF).
 */
export function validateContentType(req: {
  method?: string;
  headers?: Record<string, string | string[] | undefined>;
}): boolean {
  if (req.method === "GET" || req.method === "HEAD" || req.method === "OPTIONS") {
    return true;
  }

  const contentType = req.headers?.["content-type"] as string | undefined;
  if (!contentType) {
    return true; // tRPC GET-style batch requests may omit content-type
  }

  const allowed = [
    "application/json",
    "application/x-www-form-urlencoded",
    "multipart/form-data",
  ];

  return allowed.some((type) => contentType.toLowerCase().includes(type));
}

/**
 * Convenience: run all input security checks and throw on violation.
 * Intended for use in tRPC middleware.
 */
export function enforceInputSecurity(
  req: {
    method?: string;
    headers?: Record<string, string | string[] | undefined>;
  },
  input: unknown
): {
  csrfValid: boolean;
  contentTypeValid: boolean;
  inputFindings: Array<{ path: string; type: "xss" | "sqli"; pattern: string }>;
} {
  const csrfValid = validateOrigin(req);
  const contentTypeValid = validateContentType(req);
  const inputFindings = input != null ? scanInput(input) : [];

  if (!csrfValid) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Request origin validation failed.",
    });
  }

  if (!contentTypeValid) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Unsupported content type.",
    });
  }

  // Don't block on input findings — log them and let Zod handle validation.
  // This is defense-in-depth, not primary validation.

  return { csrfValid, contentTypeValid, inputFindings };
}
