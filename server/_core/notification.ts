/**
 * Notification Module
 *
 * Sends notifications to platform owners/admins. Currently logs to console;
 * can be extended to email, Slack, or webhook dispatch.
 */

export interface NotifyOptions {
  title: string;
  content: string;
  channel?: string;
  meta?: Record<string, unknown>;
}

/**
 * Notify the platform owner of an important event.
 * Falls back to console.log when no external channel is configured.
 */
export async function notifyOwner(opts: { title: string; content: string; channel?: string; meta?: Record<string, unknown> }): Promise<void> {
  const channel = opts.channel ?? "console";

  if (channel === "console" || !process.env.NOTIFICATION_WEBHOOK_URL) {
    console.log(`[notification] ${opts.title}: ${opts.content}`);
    return;
  }

  // Future: POST to Slack webhook or send email
  try {
    const webhookUrl = process.env.NOTIFICATION_WEBHOOK_URL;
    await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: `*${opts.title}*\n${opts.content}`,
        ...opts.meta,
      }),
    });
  } catch (err) {
    console.error("[notification] Failed to send notification:", err);
  }
}
