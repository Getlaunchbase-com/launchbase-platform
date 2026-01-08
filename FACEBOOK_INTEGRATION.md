# Facebook Integration Setup

## Overview

LaunchBase can post to Facebook pages automatically, enabling "proof of magic" for the Social Media Intelligence module. This guide covers setting up the integration for Vince's Snow Plow (pilot customer) and future customers.

## Quick Setup

### Step 1: Add Secrets to LaunchBase

Go to **Settings → Secrets** and add these two environment variables:

| Key | Value | Source |
|-----|-------|--------|
| `META_PAGE_ID` | Your Facebook page ID (numbers only) | Facebook Page Settings |
| `META_PAGE_ACCESS_TOKEN` | Long-lived page access token | Facebook Developer Console |

### Step 2: Test the Endpoint

Once secrets are added, test the endpoint:

```bash
curl -X POST "https://getlaunchbase.com/api/facebook/post" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Test post from LaunchBase",
    "pageId": "YOUR_PAGE_ID"
  }'
```

**Expected response:**
```json
{
  "success": true,
  "postId": "123456789_987654321",
  "url": "https://facebook.com/YOUR_PAGE/posts/123456789_987654321"
}
```

### Step 3: Verify on Facebook

1. Visit your Facebook page
2. Check the timeline for the new post
3. Confirm it matches the message you sent
4. Delete the test post

## Token Types & Expiration

### Page Access Token (Recommended)

**Advantages:**
- Long-lived (doesn't expire for ~60 days of non-use)
- Page-specific (can't access other pages)
- Can be regenerated without affecting other integrations

**How to get:**
1. Go to [Facebook Developers](https://developers.facebook.com)
2. Create an app or use existing one
3. Add "Pages" product
4. Navigate to Tools → Graph API Explorer
5. Select your page from dropdown
6. Generate token with `pages_manage_posts` permission
7. Copy the token (it will be long, ~200 characters)

### User Access Token (Not Recommended)

**Disadvantages:**
- Expires every 60 days
- Tied to a person (if they leave, token breaks)
- Can access other pages/data

**Only use if:**
- You're testing quickly
- You understand it will need renewal

## Implementation Details

### Endpoint: POST /api/facebook/post

**Request:**
```json
{
  "message": "Your post text here",
  "pageId": "123456789",
  "imageUrl": "https://example.com/image.jpg" // optional
}
```

**Response (Success):**
```json
{
  "success": true,
  "postId": "123456789_987654321",
  "url": "https://facebook.com/YOUR_PAGE/posts/123456789_987654321"
}
```

**Response (Error):**
```json
{
  "success": false,
  "error": "Invalid access token",
  "details": "..."
}
```

### Supported Features

✅ Text posts  
✅ Posts with images  
✅ Post scheduling (via `scheduledPublishTime`)  
✅ Multiple pages (via `pageId` parameter)  

❌ Video posts (requires separate upload endpoint)  
❌ Stories (requires different API)  
❌ Reels (requires different API)  

## Vince's Snow Plow Setup

### Page ID

Ask Vince or get from Facebook:
1. Go to facebook.com/[PAGE_NAME]
2. Open browser DevTools → Network tab
3. Look for API calls to `/[PAGE_ID]/`
4. Or use: facebook.com/[PAGE_NAME]?v=info (check URL)

### Token Generation (Safest Method)

1. **Create a dedicated app** (don't use personal account)
2. **Add Pages product** to the app
3. **Generate page-specific token** with `pages_manage_posts` permission
4. **Store in LaunchBase Secrets**
5. **Test with curl** before wiring to automation

### Scheduled Posting

Once basic posting works, wire to Social Media Intelligence:

```typescript
// Example: Auto-post approved posts
const post = await approvedPost;
await facebookPost({
  message: post.content,
  pageId: META_PAGE_ID,
  scheduledPublishTime: post.scheduledFor
});
```

## Security Best Practices

⚠️ **Token Storage:**
- Never commit tokens to git
- Store in Settings → Secrets (encrypted)
- Rotate tokens every 90 days
- Use page tokens, not user tokens

⚠️ **Permissions:**
- Request only `pages_manage_posts` (not `pages_read_engagement`)
- Don't request user data permissions
- Review app permissions quarterly

⚠️ **Error Handling:**
- Log failed posts for debugging
- Don't retry failed posts automatically (may spam)
- Alert admin if token expires

## Troubleshooting

### 401 Unauthorized

**Cause:** Token is invalid or expired  
**Fix:** Regenerate token in Facebook Developer Console, update Secrets

### 403 Forbidden

**Cause:** Token doesn't have `pages_manage_posts` permission  
**Fix:** Regenerate token with correct permissions

### Invalid Page ID

**Cause:** Page ID is wrong or token doesn't have access to that page  
**Fix:** Verify page ID is correct, regenerate token for that specific page

### Post Not Appearing

**Cause:** Page has posting restrictions or content policy violation  
**Fix:** Check page settings, review post content for policy violations

## Monitoring

### Admin Dashboard

Add a "Facebook Posts" section to admin dashboard to see:
- Last post timestamp
- Post count (last 7 days)
- Failed posts
- Token expiration date

### Logs

Check server logs for:
```
[Facebook] Posted to page 123456789: "Your message..."
[Facebook] Error posting: Invalid access token
```

## Next Steps

1. **Get Vince's page ID** (ask him or find in Facebook)
2. **Generate page access token** (follow steps above)
3. **Add to Secrets** (META_PAGE_ID, META_PAGE_ACCESS_TOKEN)
4. **Test with curl** (verify post appears on page)
5. **Wire to Social Media Intelligence** (auto-post approved posts)
6. **Monitor for 7 days** (check for token expiration, errors)

## Related Files

- `server/routes/api.facebook.post.ts` — Facebook posting endpoint (to be created)
- `server/_core/facebook.ts` — Facebook API helper (to be created)
- `drizzle/schema.ts` — Facebook posts tracking table (if needed)

## References

- [Facebook Graph API Docs](https://developers.facebook.com/docs/graph-api)
- [Pages API Reference](https://developers.facebook.com/docs/instagram-api/reference/page)
- [Access Token Guide](https://developers.facebook.com/docs/facebook-login/access-tokens)
