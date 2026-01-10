/**
 * Generate absolute URLs for emails, redirects, and external links
 * 
 * This ensures all URLs use the canonical base URL from PUBLIC_BASE_URL env var.
 * Prevents broken links in emails, mobile clients, and external systems.
 */
export function absoluteUrl(path: string): string {
  const base = process.env.PUBLIC_BASE_URL;
  
  if (!base) {
    throw new Error(
      "PUBLIC_BASE_URL environment variable is not set. " +
      "This is required for generating absolute URLs in emails and redirects."
    );
  }
  
  // Remove trailing slash from base
  const cleanBase = base.replace(/\/$/, "");
  
  // Ensure path starts with /
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  
  const url = `${cleanBase}${cleanPath}`;
  
  // Log for debugging (helps catch env var issues early)
  console.log(`[absoluteUrl] Generated: ${url}`);
  
  return url;
}
