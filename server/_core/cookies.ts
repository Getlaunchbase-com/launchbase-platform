/**
 * Session Cookie Utilities
 *
 * Provides cookie configuration for session management.
 * Adapts secure/sameSite based on environment and request origin.
 */

import type { Request, CookieOptions } from "express";

/** Default cookie name used across the platform */
export const PLATFORM_COOKIE_NAME = "lb_session";

/**
 * Returns cookie options appropriate for the current request context.
 * In production: Secure, SameSite=Lax, HttpOnly
 * In development: relaxed for localhost
 */
export function getSessionCookieOptions(
  req: Request
): CookieOptions {
  const isProduction = process.env.NODE_ENV === "production";
  const isSecure =
    isProduction ||
    req.headers["x-forwarded-proto"] === "https" ||
    req.protocol === "https";

  return {
    httpOnly: true,
    secure: isSecure,
    sameSite: isProduction ? "lax" : "none",
    path: "/",
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  };
}
