import { describe, it, expect, beforeEach } from "vitest";
import { appRouter } from "../routers";
import type { Context } from "../_core/context";

describe("admin.stripeWebhooks security boundary", () => {
  beforeEach(() => {
    // Clear env before each test
    delete process.env.ADMIN_EMAILS;
  });

  describe("Test A — denies when not admin", () => {
    it("list throws when ADMIN_EMAILS is not set (fail closed)", async () => {
      // Leave ADMIN_EMAILS unset
      const ctx: Context = {
        user: {
          id: 1,
          openId: "test-open-id",
          name: "Any User",
          email: "any@example.com",
          role: "user",
          createdAt: new Date(),
        },
        req: {} as any,
        res: {} as any,
      };

      const caller = appRouter.createCaller(ctx);

      await expect(
        caller.admin.stripeWebhooks.list({})
      ).rejects.toThrow(/ADMIN_EMAILS.*not set|admin access disabled/i);
    });

    it("list throws when user is not in ADMIN_EMAILS", async () => {
      process.env.ADMIN_EMAILS = "admin@example.com";

      const ctx: Context = {
        user: {
          id: 1,
          openId: "test-open-id",
          name: "Not Admin",
          email: "not@allowed.com",
          role: "user",
          createdAt: new Date(),
        },
        req: {} as any,
        res: {} as any,
      };

      const caller = appRouter.createCaller(ctx);

      await expect(
        caller.admin.stripeWebhooks.list({})
      ).rejects.toThrow(/forbidden/i);
    });

    it("rollup throws when user is not in ADMIN_EMAILS", async () => {
      process.env.ADMIN_EMAILS = "admin@example.com";

      const ctx: Context = {
        user: {
          id: 1,
          openId: "test-open-id",
          name: "Not Admin",
          email: "not@allowed.com",
          role: "user",
          createdAt: new Date(),
        },
        req: {} as any,
        res: {} as any,
      };

      const caller = appRouter.createCaller(ctx);

      await expect(
        caller.admin.stripeWebhooks.rollup({})
      ).rejects.toThrow(/forbidden/i);
    });
  });

  describe("Test B — allows when admin", () => {
    it("list returns array with correct shape when user is admin", async () => {
      process.env.ADMIN_EMAILS = "allowed@test.com";

      const ctx: Context = {
        user: {
          id: 1,
          openId: "test-open-id",
          name: "Admin User",
          email: "allowed@test.com",
          role: "admin",
          createdAt: new Date(),
        },
        req: {} as any,
        res: {} as any,
      };

      const caller = appRouter.createCaller(ctx);

      const result = await caller.admin.stripeWebhooks.list({});

      // Shape invariant: must return object with events array
      expect(result).toHaveProperty("events");
      expect(Array.isArray(result.events)).toBe(true);

      // Each event must have required fields
      if (result.events.length > 0) {
        const event = result.events[0];
        expect(event).toHaveProperty("eventId");
        expect(event).toHaveProperty("eventType");
        expect(event).toHaveProperty("created");
        expect(event).toHaveProperty("receivedAt");
        expect(event).toHaveProperty("ok");
        expect(event).toHaveProperty("retryCount");
        expect(event).toHaveProperty("idempotencyHit");
      }

      // Return includes filters
      expect(result).toHaveProperty("limit");
      expect(result).toHaveProperty("sinceHours");
      expect(result).toHaveProperty("status");
    });

    it("rollup returns stats object with correct shape when user is admin", async () => {
      process.env.ADMIN_EMAILS = "allowed@test.com";

      const ctx: Context = {
        user: {
          id: 1,
          openId: "test-open-id",
          name: "Admin User",
          email: "allowed@test.com",
          role: "admin",
          createdAt: new Date(),
        },
        req: {} as any,
        res: {} as any,
      };

      const caller = appRouter.createCaller(ctx);

      const result = await caller.admin.stripeWebhooks.rollup({});

      // Shape invariant: must return object with stats
      expect(result).toHaveProperty("total");
      expect(result).toHaveProperty("ok");
      expect(result).toHaveProperty("failed");
      expect(result).toHaveProperty("pending");
      expect(result).toHaveProperty("retryEvents");
      expect(result).toHaveProperty("totalRetries");
      expect(result).toHaveProperty("lastEventAt");
      expect(result).toHaveProperty("isStale");
      expect(result).toHaveProperty("topTypes");

      // All counts must be numbers
      expect(typeof result.total).toBe("number");
      expect(typeof result.ok).toBe("number");
      expect(typeof result.failed).toBe("number");
      expect(typeof result.pending).toBe("number");
      expect(typeof result.retryEvents).toBe("number");
      expect(typeof result.totalRetries).toBe("number");

      // topTypes must be array
      expect(Array.isArray(result.topTypes)).toBe(true);
    });

    it("normalizes email case (admin@TEST.com matches admin@test.com)", async () => {
      process.env.ADMIN_EMAILS = "admin@test.com";

      const ctx: Context = {
        user: {
          id: 1,
          openId: "test-open-id",
          name: "Admin User",
          email: "ADMIN@TEST.COM", // uppercase
          role: "admin",
          createdAt: new Date(),
        },
        req: {} as any,
        res: {} as any,
      };

      const caller = appRouter.createCaller(ctx);

      // Should not throw
      const result = await caller.admin.stripeWebhooks.list({});
      expect(result).toHaveProperty("events");
    });
  });
});
