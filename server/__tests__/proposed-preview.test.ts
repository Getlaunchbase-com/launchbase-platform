/**
 * FOREVER Tests: Proposed Preview Feature
 * 
 * Tests the "View Proposed Preview" feature that shows customers
 * what changes will look like before they approve.
 */

import { describe, it, expect, beforeAll } from "vitest";
import { getDb } from "../db";
import { actionRequests, intakes } from "../../drizzle/schema";
import { eq } from "drizzle-orm";
import { createActionRequest } from "../action-requests";
import { handleProposedPreview } from "../api.preview.proposed";

describe("FOREVER: Proposed Preview Feature", () => {
  let testIntakeId: number;
  let testActionRequestId: number;
  let testProposedPreviewToken: string;

  beforeAll(async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    // Create test intake
    const intakeResult = await db.insert(intakes).values({
      tenant: "launchbase",
      email: "preview-test@test.com",
      businessName: "Preview Test Business",
      contactName: "Test User",
      phone: "555-0100",
      status: "paid",
      rawPayload: {},
    });
    testIntakeId = Number(intakeResult[0].insertId);

    // Create test action request with preview token
    const actionRequest = await createActionRequest({
      tenant: "launchbase",
      intakeId: testIntakeId,
      checklistKey: "homepage.headline",
      proposedValue: "Test Headline - Professional Snow Removal",
      messageType: "DAY0_HEADLINE",
    });

    if (!actionRequest) throw new Error("Failed to create action request");
    testActionRequestId = actionRequest.id;
    testProposedPreviewToken = actionRequest.proposedPreviewToken || "";
  });

  it("FOREVER: Proposed preview renders with 200 and contains proposed text", async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    // Load action request
    const [actionRequest] = await db
      .select()
      .from(actionRequests)
      .where(eq(actionRequests.id, testActionRequestId))
      .limit(1);

    expect(actionRequest).toBeDefined();
    expect(actionRequest.proposedPreviewToken).toBeTruthy();

    // Mock request/response
    const req = {
      params: { token: actionRequest.proposedPreviewToken },
    } as any;

    let responseStatus = 0;
    let responseBody = "";

    const res = {
      status: (code: number) => {
        responseStatus = code;
        return res;
      },
      send: (body: string) => {
        responseBody = body;
        return res;
      },
    } as any;

    // Call handler
    await handleProposedPreview(req, res);

    // Assertions
    expect(responseStatus).toBe(200);
    expect(responseBody).toContain("Test Headline - Professional Snow Removal");
    expect(responseBody).toContain("Preview Mode");
    expect(responseBody).toContain("Approve This Change");
    expect(responseBody).toContain("Edit Instead");

    console.log("✅ FOREVER Test: Proposed preview renders correctly");
  });

  it("FOREVER: Expired token returns 410 with friendly message", async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    // Create action request with expired preview token
    const expiredActionRequest = await createActionRequest({
      tenant: "launchbase",
      intakeId: testIntakeId,
      checklistKey: "homepage.subheadline",
      proposedValue: "Test Subheadline",
      messageType: "DAY0_SUBHEADLINE",
    });

    if (!expiredActionRequest) throw new Error("Failed to create expired action request");

    // Manually expire the preview token
    await db
      .update(actionRequests)
      .set({
        proposedPreviewExpiresAt: new Date(Date.now() - 1000), // 1 second ago
      })
      .where(eq(actionRequests.id, expiredActionRequest.id));

    // Mock request/response
    const req = {
      params: { token: expiredActionRequest.proposedPreviewToken },
    } as any;

    let responseStatus = 0;
    let responseBody = "";

    const res = {
      status: (code: number) => {
        responseStatus = code;
        return res;
      },
      send: (body: string) => {
        responseBody = body;
        return res;
      },
    } as any;

    // Call handler
    await handleProposedPreview(req, res);

    // Assertions
    expect(responseStatus).toBe(410);
    expect(responseBody).toContain("Preview Expired");
    expect(responseBody).toContain("This preview link has expired");

    console.log("✅ FOREVER Test: Expired token returns 410");
  });

  it("FOREVER: No DB write - intake fields unchanged after preview hit", async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    // Load intake before preview
    const [intakeBefore] = await db
      .select()
      .from(intakes)
      .where(eq(intakes.id, testIntakeId))
      .limit(1);

    const businessNameBefore = intakeBefore.businessName;

    // Load action request
    const [actionRequest] = await db
      .select()
      .from(actionRequests)
      .where(eq(actionRequests.id, testActionRequestId))
      .limit(1);

    // Mock request/response
    const req = {
      params: { token: actionRequest.proposedPreviewToken },
    } as any;

    const res = {
      status: () => res,
      send: () => res,
    } as any;

    // Call handler
    await handleProposedPreview(req, res);

    // Load intake after preview
    const [intakeAfter] = await db
      .select()
      .from(intakes)
      .where(eq(intakes.id, testIntakeId))
      .limit(1);

    // Assertions: No fields changed
    expect(intakeAfter.businessName).toBe(businessNameBefore);
    expect(intakeAfter.businessName).not.toBe("Test Headline - Professional Snow Removal");

    console.log("✅ FOREVER Test: No DB write - intake unchanged");
  });

  it("FOREVER: PREVIEW_VIEWED event logged when preview is accessed", async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    // Load action request
    const [actionRequest] = await db
      .select()
      .from(actionRequests)
      .where(eq(actionRequests.id, testActionRequestId))
      .limit(1);

    // Mock request/response
    const req = {
      params: { token: actionRequest.proposedPreviewToken },
    } as any;

    const res = {
      status: () => res,
      send: () => res,
    } as any;

    // Call handler
    await handleProposedPreview(req, res);

    // Check event log
    const { actionRequestEvents } = await import("../../drizzle/schema");
    const events = await db
      .select()
      .from(actionRequestEvents)
      .where(eq(actionRequestEvents.actionRequestId, testActionRequestId));

    const previewViewedEvent = events.find((e) => e.eventType === "PREVIEW_VIEWED");
    expect(previewViewedEvent).toBeDefined();
    expect(previewViewedEvent?.actorType).toBe("customer");
    expect(previewViewedEvent?.meta).toMatchObject({
      checklistKey: "homepage.headline",
      previewToken: actionRequest.proposedPreviewToken,
    });

    console.log("✅ FOREVER Test: PREVIEW_VIEWED event logged");
  });

  it("FOREVER: Unknown checklistKey shows fallback UI with approve/edit buttons", async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    // Create action request with unknown checklistKey
    const unknownKeyRequest = await createActionRequest({
      tenant: "launchbase",
      intakeId: testIntakeId,
      checklistKey: "unknown.key.that.doesnt.exist",
      proposedValue: "Some value",
      messageType: "UNKNOWN",
    });

    if (!unknownKeyRequest) throw new Error("Failed to create unknown key action request");

    // Mock request/response
    const req = {
      params: { token: unknownKeyRequest.proposedPreviewToken },
    } as any;

    let responseStatus = 0;
    let responseBody = "";

    const res = {
      status: (code: number) => {
        responseStatus = code;
        return res;
      },
      send: (body: string) => {
        responseBody = body;
        return res;
      },
    } as any;

    // Call handler
    await handleProposedPreview(req, res);

    // Assertions
    expect(responseStatus).toBe(200);
    expect(responseBody).toContain("Preview Unavailable");
    expect(responseBody).toContain("Approve Anyway");
    expect(responseBody).toContain("Edit");

    // Check PROPOSED_PREVIEW_RENDER_FAILED event
    const { actionRequestEvents } = await import("../../drizzle/schema");
    const events = await db
      .select()
      .from(actionRequestEvents)
      .where(eq(actionRequestEvents.actionRequestId, unknownKeyRequest.id));

    const renderFailedEvent = events.find((e) => e.eventType === "PROPOSED_PREVIEW_RENDER_FAILED");
    expect(renderFailedEvent).toBeDefined();
    expect(renderFailedEvent?.reason).toContain("Unknown checklistKey");

    console.log("✅ FOREVER Test: Unknown checklistKey shows fallback UI");
  });
});
