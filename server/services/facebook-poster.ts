/**
 * Facebook Poster Service
 * 
 * Posts to Facebook Pages via Meta Graph API.
 * Requires META_PAGE_TOKEN and META_PAGE_ID environment variables.
 * 
 * To get these:
 * 1. Go to Meta Business Suite → Settings → Business Assets → Pages
 * 2. Select your page → Generate Access Token
 * 3. Copy the Page ID from the page URL
 */

// Environment variables accessed directly via process.env

const GRAPH_API_VERSION = "v18.0";
const GRAPH_API_BASE = `https://graph.facebook.com/${GRAPH_API_VERSION}`;

export interface FacebookPostResult {
  success: boolean;
  postId?: string;
  postUrl?: string;
  error?: string;
}

export interface FacebookPostInput {
  message: string;
  link?: string;
  imageUrl?: string;
}

/**
 * Post to a Facebook Page
 */
export async function postToFacebook(input: FacebookPostInput): Promise<FacebookPostResult> {
  const pageToken = process.env.META_PAGE_TOKEN;
  const pageId = process.env.META_PAGE_ID;

  if (!pageToken || !pageId) {
    return {
      success: false,
      error: "Missing META_PAGE_TOKEN or META_PAGE_ID environment variables",
    };
  }

  try {
    let endpoint: string;
    let body: Record<string, string>;

    if (input.imageUrl) {
      // Post with photo
      endpoint = `${GRAPH_API_BASE}/${pageId}/photos`;
      body = {
        url: input.imageUrl,
        caption: input.message,
        access_token: pageToken,
      };
    } else {
      // Text-only post (or with link)
      endpoint = `${GRAPH_API_BASE}/${pageId}/feed`;
      body = {
        message: input.message,
        access_token: pageToken,
      };
      if (input.link) {
        body.link = input.link;
      }
    }

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams(body),
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error: data.error?.message || "Unknown Facebook API error",
      };
    }

    // Extract post ID from response
    const postId = data.id || data.post_id;
    const postUrl = postId ? `https://facebook.com/${postId}` : undefined;

    return {
      success: true,
      postId,
      postUrl,
    };

  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Verify Facebook Page token is valid
 */
export async function verifyPageToken(): Promise<{ valid: boolean; pageName?: string; error?: string }> {
  const pageToken = process.env.META_PAGE_TOKEN;
  const pageId = process.env.META_PAGE_ID;

  if (!pageToken || !pageId) {
    return {
      valid: false,
      error: "Missing META_PAGE_TOKEN or META_PAGE_ID",
    };
  }

  try {
    const response = await fetch(
      `${GRAPH_API_BASE}/${pageId}?fields=name,access_token&access_token=${pageToken}`
    );

    const data = await response.json();

    if (!response.ok) {
      return {
        valid: false,
        error: data.error?.message || "Invalid token",
      };
    }

    return {
      valid: true,
      pageName: data.name,
    };

  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Get recent posts from the page (for verification)
 */
export async function getRecentPosts(limit: number = 5): Promise<{
  success: boolean;
  posts?: Array<{ id: string; message: string; created_time: string }>;
  error?: string;
}> {
  const pageToken = process.env.META_PAGE_TOKEN;
  const pageId = process.env.META_PAGE_ID;

  if (!pageToken || !pageId) {
    return {
      success: false,
      error: "Missing META_PAGE_TOKEN or META_PAGE_ID",
    };
  }

  try {
    const response = await fetch(
      `${GRAPH_API_BASE}/${pageId}/posts?fields=id,message,created_time&limit=${limit}&access_token=${pageToken}`
    );

    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error: data.error?.message || "Failed to fetch posts",
      };
    }

    return {
      success: true,
      posts: data.data,
    };

  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}


/**
 * Test Facebook connection - comprehensive check
 * Returns detailed status for debugging
 */
export async function testFacebookConnection(): Promise<{
  configured: boolean;
  tokenValid: boolean;
  canPublish: boolean;
  pageName?: string;
  pageId?: string;
  permissions?: string[];
  error?: string;
  recommendation?: string;
}> {
  const pageToken = process.env.META_PAGE_ACCESS_TOKEN || process.env.META_PAGE_TOKEN;
  const pageId = process.env.META_PAGE_ID;

  // Check if configured
  if (!pageToken || !pageId) {
    return {
      configured: false,
      tokenValid: false,
      canPublish: false,
      error: "Missing META_PAGE_ACCESS_TOKEN or META_PAGE_ID",
      recommendation: "Add these secrets in LaunchBase Settings → Secrets",
    };
  }

  try {
    // Step 1: Verify token and get page info
    const pageResponse = await fetch(
      `${GRAPH_API_BASE}/${pageId}?fields=name,id&access_token=${pageToken}`
    );
    const pageData = await pageResponse.json();

    if (!pageResponse.ok) {
      return {
        configured: true,
        tokenValid: false,
        canPublish: false,
        error: pageData.error?.message || "Invalid token",
        recommendation: "Your token may be expired. Generate a new long-lived Page Access Token from Meta Business Suite.",
      };
    }

    // Step 2: Check permissions
    const permResponse = await fetch(
      `${GRAPH_API_BASE}/me/permissions?access_token=${pageToken}`
    );
    const permData = await permResponse.json();

    const grantedPermissions = (permData.data || [])
      .filter((p: { status: string }) => p.status === "granted")
      .map((p: { permission: string }) => p.permission);

    const requiredPermissions = ["pages_manage_posts", "pages_read_engagement"];
    const hasPublishPermission = grantedPermissions.includes("pages_manage_posts");

    if (!hasPublishPermission) {
      return {
        configured: true,
        tokenValid: true,
        canPublish: false,
        pageName: pageData.name,
        pageId: pageData.id,
        permissions: grantedPermissions,
        error: "Missing pages_manage_posts permission",
        recommendation: "Regenerate your token with pages_manage_posts permission enabled.",
      };
    }

    return {
      configured: true,
      tokenValid: true,
      canPublish: true,
      pageName: pageData.name,
      pageId: pageData.id,
      permissions: grantedPermissions,
    };

  } catch (error) {
    return {
      configured: true,
      tokenValid: false,
      canPublish: false,
      error: error instanceof Error ? error.message : "Network error",
      recommendation: "Check your internet connection and try again.",
    };
  }
}
