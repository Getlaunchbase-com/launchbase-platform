/**
 * Facebook OAuth Service
 * Handles OAuth flow for connecting Facebook Pages
 * 
 * Flow: startOAuth → FB Auth → handleCallback → listPages → connectPage
 */

import { v4 as uuidv4 } from "uuid";
import jwt from "jsonwebtoken";
import { getDb } from "../db";
import { facebookOAuthSessions, moduleConnections } from "../../drizzle/schema";
import { eq, and } from "drizzle-orm";
import { ENV } from "../_core/env";

// Facebook OAuth configuration
const FB_APP_ID = process.env.FB_APP_ID || "";
const FB_APP_SECRET = process.env.FB_APP_SECRET || "";
const FB_REDIRECT_URI = process.env.FB_REDIRECT_URI || "";

// Required scopes for publishing to Pages
const FB_SCOPES = [
  "pages_show_list",
  "pages_read_engagement", 
  "pages_manage_posts",
  "pages_read_user_content",
].join(",");

// State signing secret (use JWT_SECRET from env)
const STATE_SECRET = ENV.cookieSecret || "fb-oauth-state-secret";

interface OAuthState {
  customerId: number;
  userId: number;
  nonce: string;
  returnTo?: string;
}

interface FacebookPage {
  pageId: string;
  pageName: string;
  accessToken: string;
}

/**
 * Generate signed state for OAuth flow
 */
function signState(state: OAuthState): string {
  return jwt.sign(state, STATE_SECRET, { expiresIn: "15m" });
}

/**
 * Verify and decode signed state
 */
function verifyState(signedState: string): OAuthState | null {
  try {
    return jwt.verify(signedState, STATE_SECRET) as OAuthState;
  } catch {
    return null;
  }
}

/**
 * Start OAuth flow - generates auth URL
 */
export async function startOAuth(
  customerId: number,
  userId: number,
  returnTo?: string
): Promise<{ url: string }> {
  const nonce = uuidv4();
  const state = signState({ customerId, userId, nonce, returnTo });

  const authUrl = new URL("https://www.facebook.com/v18.0/dialog/oauth");
  authUrl.searchParams.set("client_id", FB_APP_ID);
  authUrl.searchParams.set("redirect_uri", FB_REDIRECT_URI);
  authUrl.searchParams.set("scope", FB_SCOPES);
  authUrl.searchParams.set("state", state);
  authUrl.searchParams.set("response_type", "code");

  return { url: authUrl.toString() };
}

/**
 * Handle OAuth callback - exchange code for token, create session
 */
export async function handleCallback(
  code: string,
  signedState: string
): Promise<{ connectSessionId: string; error?: string }> {
  const db = await getDb();
  if (!db) {
    return { connectSessionId: "", error: "Database unavailable" };
  }

  // Verify state
  const state = verifyState(signedState);
  if (!state) {
    // Create failed session
    const sessionId = uuidv4();
    await db.insert(facebookOAuthSessions).values({
      id: sessionId,
      customerId: 0,
      userId: 0,
      status: "failed",
      error: "Invalid or expired state",
      expiresAt: new Date(Date.now() + 15 * 60 * 1000),
    });
    return { connectSessionId: sessionId, error: "Invalid state" };
  }

  try {
    // Exchange code for user access token
    const tokenUrl = new URL("https://graph.facebook.com/v18.0/oauth/access_token");
    tokenUrl.searchParams.set("client_id", FB_APP_ID);
    tokenUrl.searchParams.set("client_secret", FB_APP_SECRET);
    tokenUrl.searchParams.set("redirect_uri", FB_REDIRECT_URI);
    tokenUrl.searchParams.set("code", code);

    const tokenResponse = await fetch(tokenUrl.toString());
    const tokenData = await tokenResponse.json();

    if (tokenData.error) {
      const sessionId = uuidv4();
      await db.insert(facebookOAuthSessions).values({
        id: sessionId,
        customerId: state.customerId,
        userId: state.userId,
        status: "failed",
        error: tokenData.error.message || "Token exchange failed",
        returnTo: state.returnTo,
        expiresAt: new Date(Date.now() + 15 * 60 * 1000),
      });
      return { connectSessionId: sessionId, error: tokenData.error.message };
    }

    const userAccessToken = tokenData.access_token;

    // Fetch user's managed pages
    const pagesUrl = new URL("https://graph.facebook.com/v18.0/me/accounts");
    pagesUrl.searchParams.set("access_token", userAccessToken);
    pagesUrl.searchParams.set("fields", "id,name,access_token");

    const pagesResponse = await fetch(pagesUrl.toString());
    const pagesData = await pagesResponse.json();

    const pages: FacebookPage[] = (pagesData.data || []).map((p: { id: string; name: string; access_token: string }) => ({
      pageId: p.id,
      pageName: p.name,
      accessToken: p.access_token,
    }));

    // Create session with pages
    const sessionId = uuidv4();
    await db.insert(facebookOAuthSessions).values({
      id: sessionId,
      customerId: state.customerId,
      userId: state.userId,
      status: "pages_ready",
      userAccessToken: userAccessToken, // Will be deleted after connectPage
      scopesGranted: FB_SCOPES.split(","),
      pages: pages,
      returnTo: state.returnTo,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000),
    });

    return { connectSessionId: sessionId };
  } catch (error) {
    const sessionId = uuidv4();
    await db.insert(facebookOAuthSessions).values({
      id: sessionId,
      customerId: state.customerId,
      userId: state.userId,
      status: "failed",
      error: error instanceof Error ? error.message : "Unknown error",
      returnTo: state.returnTo,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000),
    });
    return { connectSessionId: sessionId, error: "OAuth failed" };
  }
}

/**
 * Get session and validate ownership
 */
export async function getSession(
  connectSessionId: string,
  userId: number
): Promise<{
  session: typeof facebookOAuthSessions.$inferSelect | null;
  error?: string;
}> {
  const db = await getDb();
  if (!db) {
    return { session: null, error: "Database unavailable" };
  }

  const [session] = await db
    .select()
    .from(facebookOAuthSessions)
    .where(eq(facebookOAuthSessions.id, connectSessionId))
    .limit(1);

  if (!session) {
    return { session: null, error: "Session not found" };
  }

  if (session.userId !== userId) {
    return { session: null, error: "Session does not belong to user" };
  }

  if (new Date(session.expiresAt) < new Date()) {
    return { session: null, error: "Session expired" };
  }

  return { session };
}

/**
 * List available pages from session
 */
export async function listPages(
  connectSessionId: string,
  userId: number
): Promise<{ pages: Array<{ pageId: string; pageName: string }>; error?: string }> {
  const { session, error } = await getSession(connectSessionId, userId);
  
  if (error || !session) {
    return { pages: [], error: error || "Session not found" };
  }

  if (session.status !== "pages_ready") {
    return { pages: [], error: `Invalid session status: ${session.status}` };
  }

  const pages = (session.pages || []).map((p) => ({
    pageId: p.pageId,
    pageName: p.pageName,
  }));

  return { pages };
}

/**
 * Connect a specific page
 */
export async function connectPage(
  connectSessionId: string,
  userId: number,
  pageId: string
): Promise<{ success: boolean; pageName?: string; error?: string }> {
  const db = await getDb();
  if (!db) {
    return { success: false, error: "Database unavailable" };
  }

  const { session, error } = await getSession(connectSessionId, userId);
  
  if (error || !session) {
    return { success: false, error: error || "Session not found" };
  }

  if (session.status !== "pages_ready") {
    return { success: false, error: `Invalid session status: ${session.status}` };
  }

  // Find the selected page
  const selectedPage = (session.pages || []).find((p) => p.pageId === pageId);
  if (!selectedPage) {
    return { success: false, error: "Page not found in session" };
  }

  // Verify the page token works by making a test call
  const verifyUrl = new URL(`https://graph.facebook.com/v18.0/${pageId}`);
  verifyUrl.searchParams.set("access_token", selectedPage.accessToken);
  verifyUrl.searchParams.set("fields", "id,name");

  try {
    const verifyResponse = await fetch(verifyUrl.toString());
    const verifyData = await verifyResponse.json();

    if (verifyData.error) {
      // Mark session as failed
      await db
        .update(facebookOAuthSessions)
        .set({ status: "failed", error: verifyData.error.message })
        .where(eq(facebookOAuthSessions.id, connectSessionId));

      return { success: false, error: verifyData.error.message };
    }

    // Upsert the connection
    const existingConnection = await db
      .select()
      .from(moduleConnections)
      .where(
        and(
          eq(moduleConnections.userId, userId),
          eq(moduleConnections.connectionType, "facebook_page")
        )
      )
      .limit(1);

    if (existingConnection.length > 0) {
      // Update existing
      await db
        .update(moduleConnections)
        .set({
          accessToken: selectedPage.accessToken,
          externalId: pageId,
          externalName: selectedPage.pageName,
          status: "active",
          lastSyncAt: new Date(),
          lastError: null,
          updatedAt: new Date(),
        })
        .where(eq(moduleConnections.id, existingConnection[0].id));
    } else {
      // Create new
      await db.insert(moduleConnections).values({
        userId: userId,
        moduleKey: "social_media_intelligence",
        connectionType: "facebook_page",
        accessToken: selectedPage.accessToken,
        externalId: pageId,
        externalName: selectedPage.pageName,
        status: "active",
        lastSyncAt: new Date(),
      });
    }

    // Mark session as connected and clear tokens
    await db
      .update(facebookOAuthSessions)
      .set({
        status: "connected",
        userAccessToken: null, // Delete user token
        pages: null, // Clear page tokens
      })
      .where(eq(facebookOAuthSessions.id, connectSessionId));

    return { success: true, pageName: selectedPage.pageName };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Connection failed",
    };
  }
}
