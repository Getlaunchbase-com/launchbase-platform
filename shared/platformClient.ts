/**
 * Platform Client
 * Thin client for customer sites to consume LaunchBase platform services
 * 
 * ARCHITECTURE RULE: Customer sites must not store tokens, API keys, or run decision logic.
 * All intelligence lives in LaunchBase. Sites only consume.
 */

import type {
  FacebookConnectionStatus,
  DraftListResponse,
  ApproveDraftResponse,
  ContextSummary,
} from './platform-types';

export interface PlatformClientConfig {
  apiUrl: string;
  apiKey: string;
  customerId: string;
}

export class PlatformClient {
  private config: PlatformClientConfig;

  constructor(config: PlatformClientConfig) {
    this.config = config;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const response = await fetch(`${this.config.apiUrl}${endpoint}`, {
      ...options,
      headers: {
        'Authorization': `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json',
        'X-Customer-Id': this.config.customerId,
        ...options.headers,
      },
    });

    if (!response.ok) {
      throw new Error(`Platform API error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Get Facebook connection status for this customer
   */
  async getFacebookConnectionStatus(): Promise<FacebookConnectionStatus> {
    return this.request<FacebookConnectionStatus>(
      `/api/platform/facebook/status/${this.config.customerId}`
    );
  }

  /**
   * List pending drafts for this customer
   */
  async listDrafts(status?: 'pending' | 'approved' | 'published'): Promise<DraftListResponse> {
    const params = status ? `?status=${status}` : '';
    return this.request<DraftListResponse>(
      `/api/platform/drafts/${this.config.customerId}${params}`
    );
  }

  /**
   * Approve a draft for publishing
   */
  async approveDraft(draftId: number, publishAt?: Date): Promise<ApproveDraftResponse> {
    return this.request<ApproveDraftResponse>(
      `/api/platform/drafts/${draftId}/approve`,
      {
        method: 'POST',
        body: JSON.stringify({
          draftId,
          publishAt: publishAt?.toISOString(),
        }),
      }
    );
  }

  /**
   * Verify Facebook connection is still valid
   */
  async verifyFacebookConnection(): Promise<{ valid: boolean; error?: string }> {
    return this.request<{ valid: boolean; error?: string }>(
      `/api/platform/facebook/verify/${this.config.customerId}`,
      { method: 'POST' }
    );
  }

  /**
   * Get current context summary (weather, trends, recommendation)
   * Optional - for sites that want to display context info
   */
  async getContextSummary(): Promise<ContextSummary> {
    return this.request<ContextSummary>(
      `/api/platform/context/${this.config.customerId}`
    );
  }
}

/**
 * Factory function for creating a platform client
 * Use environment variables for configuration
 */
export function createPlatformClient(): PlatformClient {
  const apiUrl = process.env.LAUNCHBASE_API_URL;
  const apiKey = process.env.LAUNCHBASE_API_KEY;
  const customerId = process.env.LAUNCHBASE_CUSTOMER_ID;

  if (!apiUrl || !apiKey || !customerId) {
    throw new Error('Missing LaunchBase platform configuration. Set LAUNCHBASE_API_URL, LAUNCHBASE_API_KEY, and LAUNCHBASE_CUSTOMER_ID.');
  }

  return new PlatformClient({ apiUrl, apiKey, customerId });
}
