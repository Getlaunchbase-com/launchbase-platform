/**
 * Facebook OAuth Express Routes
 * Thin routes that delegate to facebookOAuth service
 * 
 * GET /api/facebook/oauth/start - Start OAuth flow
 * GET /api/facebook/oauth/callback - Handle OAuth callback
 */

import type { Express, Request, Response } from "express";
import { startOAuth, handleCallback } from "../services/facebookOAuth";
import { sdk } from "./sdk";
import { COOKIE_NAME } from "@shared/const";

function getQueryParam(req: Request, key: string): string | undefined {
  const value = req.query[key];
  return typeof value === "string" ? value : undefined;
}

/**
 * Get current user from session cookie
 */
async function getCurrentUser(req: Request): Promise<{ id: number; openId: string } | null> {
  const sessionToken = req.cookies?.[COOKIE_NAME];
  if (!sessionToken) return null;

  try {
    const payload = await sdk.verifySession(sessionToken);
    if (!payload?.openId) return null;
    
    // For now, use openId hash as numeric id (or look up from DB)
    // This is a simplification - in production you'd query the users table
    const numericId = Math.abs(hashCode(payload.openId));
    return { id: numericId, openId: payload.openId };
  } catch {
    return null;
  }
}

// Simple hash function for openId -> numeric id
function hashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return hash;
}

export function registerFacebookOAuthRoutes(app: Express) {
  /**
   * GET /api/facebook/oauth/start
   * Starts the Facebook OAuth flow
   * Query params:
   *   - customerId (optional, defaults to current user)
   *   - returnTo (optional, where to redirect after connect)
   */
  app.get("/api/facebook/oauth/start", async (req: Request, res: Response) => {
    try {
      const user = await getCurrentUser(req);
      if (!user) {
        res.status(401).json({ error: "Not authenticated" });
        return;
      }

      const customerId = parseInt(getQueryParam(req, "customerId") || String(user.id));
      const returnTo = getQueryParam(req, "returnTo") || "/settings/facebook";

      const { url } = await startOAuth(customerId, user.id, returnTo);
      
      // Redirect to Facebook OAuth
      res.redirect(302, url);
    } catch (error) {
      console.error("[Facebook OAuth] Start failed:", error);
      res.status(500).json({ error: "Failed to start OAuth" });
    }
  });

  /**
   * GET /api/facebook/oauth/callback
   * Handles the OAuth callback from Facebook
   * Query params:
   *   - code (from Facebook)
   *   - state (signed state we sent)
   */
  app.get("/api/facebook/oauth/callback", async (req: Request, res: Response) => {
    const code = getQueryParam(req, "code");
    const state = getQueryParam(req, "state");

    if (!code || !state) {
      res.redirect(302, "/settings/facebook/connect?error=missing_params");
      return;
    }

    try {
      const { connectSessionId, error } = await handleCallback(code, state);

      if (error) {
        console.error("[Facebook OAuth] Callback error:", error);
        res.redirect(302, `/settings/facebook/connect?connectSessionId=${connectSessionId}&error=${encodeURIComponent(error)}`);
        return;
      }

      // Success - redirect to page selection
      res.redirect(302, `/settings/facebook/connect?connectSessionId=${connectSessionId}`);
    } catch (error) {
      console.error("[Facebook OAuth] Callback failed:", error);
      res.redirect(302, "/settings/facebook/connect?error=callback_failed");
    }
  });
}
