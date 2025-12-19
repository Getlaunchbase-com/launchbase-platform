import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// Mock the email module
vi.mock("./email", () => ({
  sendEmail: vi.fn().mockResolvedValue(true),
  AdminNotifications: {
    newIntake: vi.fn().mockResolvedValue(true),
    lowConfidence: vi.fn().mockResolvedValue(true),
    siteApproved: vi.fn().mockResolvedValue(true),
  },
}));

// Mock the analytics module
vi.mock("./analytics", () => ({
  trackEvent: vi.fn().mockResolvedValue(true),
  getFunnelMetrics: vi.fn().mockResolvedValue(null),
  getBuildQualityMetrics: vi.fn().mockResolvedValue(null),
  getVerticalMetrics: vi.fn().mockResolvedValue(null),
  getDailyHealth: vi.fn().mockResolvedValue(null),
}));

// Mock the database module
vi.mock("./db", () => ({
  getDb: vi.fn().mockResolvedValue({
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockResolvedValue(undefined),
    }),
  }),
  createIntake: vi.fn().mockResolvedValue({ id: 1 }),
  getIntakes: vi.fn().mockResolvedValue([]),
  getIntakeById: vi.fn().mockResolvedValue(null),
  updateIntakeStatus: vi.fn().mockResolvedValue(undefined),
  createBuildPlan: vi.fn().mockResolvedValue({ id: 1 }),
  getBuildPlanById: vi.fn().mockResolvedValue(null),
  getBuildPlanByIntakeId: vi.fn().mockResolvedValue(null),
  updateBuildPlanStatus: vi.fn().mockResolvedValue(undefined),
  createClarification: vi.fn().mockResolvedValue({ id: 1, token: "test-token-123" }),
  getClarificationByToken: vi.fn().mockResolvedValue(null),
  submitClarificationAnswer: vi.fn().mockResolvedValue({ success: true }),
  createDeployment: vi.fn().mockResolvedValue({ id: 1 }),
  getDeploymentById: vi.fn().mockResolvedValue(null),
  getDeployments: vi.fn().mockResolvedValue([]),
  updateDeploymentStatus: vi.fn().mockResolvedValue(undefined),
  runDeployment: vi.fn().mockResolvedValue({ success: true }),
}));

function createPublicContext(): TrpcContext {
  return {
    user: null,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: vi.fn(),
    } as unknown as TrpcContext["res"],
  };
}

function createAuthContext(): TrpcContext {
  return {
    user: {
      id: 1,
      openId: "admin-user",
      email: "admin@launchbase.com",
      name: "Admin User",
      loginMethod: "manus",
      role: "admin",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: vi.fn(),
    } as unknown as TrpcContext["res"],
  };
}

describe("intake.submit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("accepts a valid intake submission", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.intake.submit({
      businessName: "Smith Plumbing Co.",
      contactName: "John Smith",
      email: "john@smithplumbing.com",
      phone: "555-123-4567",
      vertical: "trades",
      services: ["Emergency Repairs", "Drain Cleaning", "Water Heater Installation"],
      serviceArea: ["Dallas, TX", "Fort Worth, TX"],
      primaryCTA: "call",
      tagline: "Your trusted local plumber since 2005",
    });

    expect(result).toEqual({ success: true, intakeId: 1 });
  });

  it("accepts minimal required fields", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.intake.submit({
      businessName: "Test Business",
      contactName: "Test User",
      email: "test@example.com",
      vertical: "appointments",
    });

    expect(result).toEqual({ success: true, intakeId: 1 });
  });

  it("rejects invalid email", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.intake.submit({
        businessName: "Test Business",
        contactName: "Test User",
        email: "invalid-email",
        vertical: "trades",
      })
    ).rejects.toThrow();
  });

  it("rejects empty business name", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.intake.submit({
        businessName: "",
        contactName: "Test User",
        email: "test@example.com",
        vertical: "trades",
      })
    ).rejects.toThrow();
  });

  it("accepts all vertical types", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    for (const vertical of ["trades", "appointments", "professional"] as const) {
      const result = await caller.intake.submit({
        businessName: `${vertical} Business`,
        contactName: "Test User",
        email: "test@example.com",
        vertical,
      });

      expect(result.success).toBe(true);
    }
  });
});

describe("clarify routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns null for non-existent token", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.clarify.get({ token: "non-existent-token" });

    expect(result).toBeNull();
  });

  it("submits clarification answer", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.clarify.submit({
      token: "test-token",
      answer: "This is my answer",
    });

    expect(result).toEqual({ success: true });
  });
});

describe("admin.clarify.create", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a clarification request when authenticated", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.admin.clarify.create({
      intakeId: 1,
      questionKey: "services",
      questionText: "Can you list your top 3 services?",
      inputType: "text",
    });

    expect(result.success).toBe(true);
    expect(result.token).toBe("test-token-123");
    expect(result.link).toBe("/clarify/test-token-123");
  });

  it("rejects unauthenticated requests", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.admin.clarify.create({
        intakeId: 1,
        questionKey: "services",
        questionText: "Can you list your top 3 services?",
      })
    ).rejects.toThrow();
  });
});
