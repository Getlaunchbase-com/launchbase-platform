/**
 * Facebook Poster Service
 *
 * Posts content to Facebook Pages via the Graph API.
 * Requires a valid Page Access Token with pages_manage_posts permission.
 */

// ---------------------------------------------------------------------------
// postToFacebook
// ---------------------------------------------------------------------------

export async function postToFacebook(data: {
  pageId?: string;
  message: string;
  accessToken?: string;
  link?: string;
  imageUrl?: string;
}): Promise<{ success: boolean; postId?: string; postUrl?: string; error?: string }> {
  const pageId = data.pageId || process.env.FACEBOOK_PAGE_ID;
  const accessToken = data.accessToken || process.env.FACEBOOK_PAGE_ACCESS_TOKEN;

  if (!pageId || !accessToken) {
    console.log(
      "[facebook-poster] No Facebook credentials configured. Post would be:",
      data.message.substring(0, 100),
    );
    return {
      success: false,
      error: "Facebook credentials not configured. Set FACEBOOK_PAGE_ID and FACEBOOK_PAGE_ACCESS_TOKEN.",
    };
  }

  try {
    const url = `https://graph.facebook.com/v18.0/${pageId}/feed`;
    const body: Record<string, string> = {
      message: data.message,
      access_token: accessToken,
    };

    if (data.link) {
      body.link = data.link;
    }

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const result = (await response.json()) as any;

    if (!response.ok || result.error) {
      const errorMsg =
        result.error?.message || `Facebook API error ${response.status}`;
      console.error("[facebook-poster] Post failed:", errorMsg);
      return { success: false, error: errorMsg };
    }

    console.log("[facebook-poster] Post published:", result.id);
    const postUrl = result.id ? `https://www.facebook.com/${result.id}` : undefined;
    return { success: true, postId: result.id, postUrl };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error("[facebook-poster] Error:", errorMsg);
    return { success: false, error: errorMsg };
  }
}

// ---------------------------------------------------------------------------
// testFacebookConnection
// ---------------------------------------------------------------------------

export async function testFacebookConnection(): Promise<{
  connected: boolean;
  pages: Array<{ id: string; name: string; accessToken?: string }>;
  error?: string;
}> {
  const pageId = process.env.FACEBOOK_PAGE_ID;
  const pageAccessToken = process.env.FACEBOOK_PAGE_ACCESS_TOKEN;
  const userAccessToken = process.env.FACEBOOK_USER_ACCESS_TOKEN;

  // If we have page-level credentials, test them directly
  if (pageId && pageAccessToken) {
    try {
      const url = `https://graph.facebook.com/v18.0/${pageId}?fields=id,name&access_token=${pageAccessToken}`;
      const response = await fetch(url);
      const result = (await response.json()) as any;

      if (response.ok && result.id) {
        return {
          connected: true,
          pages: [
            {
              id: result.id,
              name: result.name || "Connected Page",
            },
          ],
        };
      }

      return {
        connected: false,
        pages: [],
        error: result.error?.message || "Failed to verify page connection",
      };
    } catch (err) {
      return {
        connected: false,
        pages: [],
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  // If we have a user token, fetch managed pages
  if (userAccessToken) {
    try {
      const url = `https://graph.facebook.com/v18.0/me/accounts?access_token=${userAccessToken}`;
      const response = await fetch(url);
      const result = (await response.json()) as any;

      if (response.ok && result.data) {
        const pages = result.data.map((page: any) => ({
          id: page.id,
          name: page.name,
          accessToken: page.access_token,
        }));
        return { connected: pages.length > 0, pages };
      }

      return {
        connected: false,
        pages: [],
        error: result.error?.message || "Failed to fetch pages",
      };
    } catch (err) {
      return {
        connected: false,
        pages: [],
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  return {
    connected: false,
    pages: [],
    error: "No Facebook credentials configured. Set FACEBOOK_PAGE_ID and FACEBOOK_PAGE_ACCESS_TOKEN.",
  };
}
