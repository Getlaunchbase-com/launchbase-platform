/**
 * Security Hardening — Main Entry Point
 *
 * Re-exports all security modules for convenient imports:
 *
 *   import { enforceRateLimit, RATE_LIMITS, auditLog, verifyProjectAccess } from "../security";
 *
 * Architecture:
 *   - rateLimit.ts        — In-memory sliding-window rate limiter
 *   - verifyProjectAccess — Tenant-scoped RBAC for project resources
 *   - auditLog.ts         — Append-only security event log
 *   - inputSanitizer.ts   — XSS/SQLi detection + CSRF origin validation
 */

// Rate limiting
export {
  checkRateLimit,
  enforceRateLimit,
  getClientIp,
  RATE_LIMITS,
  type RateLimitConfig,
  type RateLimitResult,
} from "./rateLimit";

// Project access verification
export {
  verifyProjectAccess,
  requireAdmin,
  requireAuth,
  type AccessContext,
  type ResourceDescriptor,
  type AccessResult,
  type Tenant,
  type Role,
} from "./verifyProjectAccess";

// Audit logging
export {
  auditLog,
  registerAuditWriter,
  flushAuditLog,
} from "./auditLog";

// Input sanitization & CSRF
export {
  detectXssPattern,
  detectSqlInjection,
  scanInput,
  validateOrigin,
  validateContentType,
  enforceInputSecurity,
} from "./inputSanitizer";
