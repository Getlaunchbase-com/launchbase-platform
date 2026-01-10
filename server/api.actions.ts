/**
 * Public API endpoints for action request approve/edit links
 * 
 * These endpoints are accessed via tokenized links in customer emails:
 * - GET /api/actions/:token/approve
 * - GET /api/actions/:token/edit
 */

import type { Request, Response } from "express";
import { getActionRequestByToken, applyActionRequest, confirmAndLockActionRequest } from "./action-requests";
import { sendEmail } from "./email";

/**
 * GET /api/actions/:token/approve
 * Customer clicks "✅ Approve" button in email
 */
export async function handleApprove(req: Request, res: Response) {
  const { token } = req.params;

  // Load action request
  const actionRequest = await getActionRequestByToken(token);
  if (!actionRequest) {
    return res.status(404).send("Action request not found or expired");
  }

  // Check if already processed
  if (actionRequest.status === "locked") {
    return res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Already Approved</title>
        <style>
          body { font-family: system-ui; max-width: 600px; margin: 50px auto; padding: 20px; }
          .success { color: #16a34a; }
        </style>
      </head>
      <body>
        <h1 class="success">✅ Already Approved</h1>
        <p>This change was already approved and applied.</p>
      </body>
      </html>
    `);
  }

  // Mark as responded (approved via link)
  const db = await import("./db").then(m => m.getDb());
  if (db) {
    await db.update(await import("../drizzle/schema").then(m => m.actionRequests))
      .set({
        status: "responded",
        respondedAt: new Date(),
        replyChannel: "link",
        confidence: 0.95, // High confidence for button click
        rawInbound: { method: "approve_link", token } as any,
      })
      .where((await import("drizzle-orm").then(m => m.eq))(
        (await import("../drizzle/schema").then(m => m.actionRequests)).id,
        actionRequest.id
      ));
  }

  // Apply the change
  const result = await applyActionRequest(actionRequest.id);

  if (result.success) {
    // Send confirmation email
    // TODO: Implement sendConfirmationEmail()

    // Mark as confirmed and locked
    await confirmAndLockActionRequest(actionRequest.id);

    return res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Approved</title>
        <style>
          body { font-family: system-ui; max-width: 600px; margin: 50px auto; padding: 20px; }
          .success { color: #16a34a; }
        </style>
      </head>
      <body>
        <h1 class="success">✅ Approved</h1>
        <p>Your change has been applied. You'll receive a confirmation email shortly.</p>
      </body>
      </html>
    `);
  } else if (result.needsHuman) {
    return res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Needs Review</title>
        <style>
          body { font-family: system-ui; max-width: 600px; margin: 50px auto; padding: 20px; }
          .warning { color: #ea580c; }
        </style>
      </head>
      <body>
        <h1 class="warning">⚠️ Needs Review</h1>
        <p>This change requires manual review. We've notified our team and will get back to you shortly.</p>
      </body>
      </html>
    `);
  } else {
    return res.status(500).send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Error</title>
        <style>
          body { font-family: system-ui; max-width: 600px; margin: 50px auto; padding: 20px; }
          .error { color: #dc2626; }
        </style>
      </head>
      <body>
        <h1 class="error">❌ Error</h1>
        <p>${result.error || "Failed to apply change"}</p>
      </body>
      </html>
    `);
  }
}

/**
 * GET /api/actions/:token/edit
 * Customer clicks "✏️ Edit" button in email
 */
export async function handleEditForm(req: Request, res: Response) {
  const { token } = req.params;

  // Load action request
  const actionRequest = await getActionRequestByToken(token);
  if (!actionRequest) {
    return res.status(404).send("Action request not found or expired");
  }

  // Check if already processed
  if (actionRequest.status === "locked") {
    return res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Already Locked</title>
        <style>
          body { font-family: system-ui; max-width: 600px; margin: 50px auto; padding: 20px; }
        </style>
      </head>
      <body>
        <h1>🔒 Already Locked</h1>
        <p>This item has already been approved and locked.</p>
      </body>
      </html>
    `);
  }

  // Show edit form
  return res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Edit Your Response</title>
      <style>
        body { font-family: system-ui; max-width: 600px; margin: 50px auto; padding: 20px; }
        label { display: block; margin-bottom: 8px; font-weight: 500; }
        textarea { width: 100%; min-height: 120px; padding: 12px; border: 1px solid #d1d5db; border-radius: 6px; font-family: inherit; }
        button { background: #ea580c; color: white; border: none; padding: 12px 24px; border-radius: 6px; font-weight: 500; cursor: pointer; margin-top: 16px; }
        button:hover { background: #c2410c; }
        .proposed { background: #f3f4f6; padding: 16px; border-radius: 6px; margin-bottom: 24px; }
      </style>
    </head>
    <body>
      <h1>✏️ Edit Your Response</h1>
      
      <div class="proposed">
        <strong>We proposed:</strong>
        <p>${JSON.stringify(actionRequest.proposedValue)}</p>
      </div>

      <form method="POST" action="/api/actions/${token}/edit">
        <label for="value">Your edit:</label>
        <textarea id="value" name="value" required placeholder="Enter your preferred value..."></textarea>
        <button type="submit">Submit Edit</button>
      </form>
    </body>
    </html>
  `);
}

/**
 * POST /api/actions/:token/edit
 * Customer submits edit form
 */
export async function handleEditSubmit(req: Request, res: Response) {
  const { token } = req.params;
  const { value } = req.body;

  if (!value || typeof value !== "string") {
    return res.status(400).send("Invalid value");
  }

  // Load action request
  const actionRequest = await getActionRequestByToken(token);
  if (!actionRequest) {
    return res.status(404).send("Action request not found or expired");
  }

  // Classify the reply
  const { classifyReply } = await import("./action-requests");
  const classification = classifyReply(value, actionRequest.proposedValue);

  // Update action request with response
  const db = await import("./db").then(m => m.getDb());
  if (db) {
    await db.update(await import("../drizzle/schema").then(m => m.actionRequests))
      .set({
        status: "responded",
        respondedAt: new Date(),
        replyChannel: "link",
        confidence: classification.confidence,
        rawInbound: { method: "edit_form", value, classification } as any,
        proposedValue: classification.extractedValue || value,
      })
      .where((await import("drizzle-orm").then(m => m.eq))(
        (await import("../drizzle/schema").then(m => m.actionRequests)).id,
        actionRequest.id
      ));
  }

  // Apply the change
  const result = await applyActionRequest(actionRequest.id);

  if (result.success) {
    await confirmAndLockActionRequest(actionRequest.id);
    return res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Edit Applied</title>
        <style>
          body { font-family: system-ui; max-width: 600px; margin: 50px auto; padding: 20px; }
          .success { color: #16a34a; }
        </style>
      </head>
      <body>
        <h1 class="success">✅ Edit Applied</h1>
        <p>Your change has been applied. You'll receive a confirmation email shortly.</p>
      </body>
      </html>
    `);
  } else if (result.needsConfirmation) {
    return res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Confirm Your Edit</title>
        <style>
          body { font-family: system-ui; max-width: 600px; margin: 50px auto; padding: 20px; }
          .confirm { background: #fef3c7; padding: 16px; border-radius: 6px; margin: 24px 0; }
          button { background: #16a34a; color: white; border: none; padding: 12px 24px; border-radius: 6px; font-weight: 500; cursor: pointer; margin-right: 12px; }
          button.secondary { background: #6b7280; }
        </style>
      </head>
      <body>
        <h1>🟨 Confirm Your Edit</h1>
        <div class="confirm">
          <strong>To confirm:</strong>
          <p>${value}</p>
        </div>
        <form method="POST" action="/api/actions/${token}/confirm">
          <button type="submit" name="confirm" value="yes">✅ Yes, Apply This</button>
          <button type="submit" name="confirm" value="no" class="secondary">❌ Cancel</button>
        </form>
      </body>
      </html>
    `);
  } else if (result.needsHuman) {
    return res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Needs Review</title>
        <style>
          body { font-family: system-ui; max-width: 600px; margin: 50px auto; padding: 20px; }
          .warning { color: #ea580c; }
        </style>
      </head>
      <body>
        <h1 class="warning">⚠️ Needs Review</h1>
        <p>This change requires manual review. We've notified our team and will get back to you shortly.</p>
      </body>
      </html>
    `);
  } else {
    return res.status(500).send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Error</title>
        <style>
          body { font-family: system-ui; max-width: 600px; margin: 50px auto; padding: 20px; }
          .error { color: #dc2626; }
        </style>
      </head>
      <body>
        <h1 class="error">❌ Error</h1>
        <p>${result.error || "Failed to apply change"}</p>
      </body>
      </html>
    `);
  }
}
