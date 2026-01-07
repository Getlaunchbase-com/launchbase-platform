/**
 * Facebook Webhook Express Routes
 * Handles webhook verification and event processing
 */

import { Router, Request, Response } from "express";
import {
  verifyWebhookSignature,
  handleWebhookVerification,
  processWebhookEvent,
} from "../services/facebookWebhook";

export function createFacebookWebhookRoutes(): Router {
  const router = Router();

  /**
   * GET /api/facebook/webhook
   * Webhook verification from Facebook
   */
  router.get("/webhook", (req: Request, res: Response) => {
    const params = {
      "hub.mode": req.query["hub.mode"] as string | undefined,
      "hub.verify_token": req.query["hub.verify_token"] as string | undefined,
      "hub.challenge": req.query["hub.challenge"] as string | undefined,
    };

    const result = handleWebhookVerification(params);

    if (result.success && result.challenge) {
      res.status(200).send(result.challenge);
    } else {
      res.status(403).json({ error: result.error || "Forbidden" });
    }
  });

  /**
   * POST /api/facebook/webhook
   * Receive webhook events from Facebook
   */
  router.post("/webhook", async (req: Request, res: Response) => {
    // Verify signature
    const signature = req.headers["x-hub-signature-256"] as string;
    const rawBody = JSON.stringify(req.body);

    if (!verifyWebhookSignature(rawBody, signature)) {
      console.error("[Facebook Webhook] Invalid signature");
      return res.status(403).json({ error: "Invalid signature" });
    }

    // Process event asynchronously (don't block Facebook's webhook)
    processWebhookEvent(req.body).catch((error) => {
      console.error("[Facebook Webhook] Processing error", error);
    });

    // Respond immediately to Facebook
    res.status(200).json({ success: true });
  });

  return router;
}
