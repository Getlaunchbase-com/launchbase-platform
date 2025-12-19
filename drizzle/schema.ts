import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, json, boolean } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Customer intakes from onboarding flow
 */
export const intakes = mysqlTable("intakes", {
  id: int("id").autoincrement().primaryKey(),
  // Business info
  businessName: varchar("businessName", { length: 255 }).notNull(),
  contactName: varchar("contactName", { length: 255 }).notNull(),
  email: varchar("email", { length: 320 }).notNull(),
  phone: varchar("phone", { length: 32 }),
  // AI-inferred vertical
  vertical: mysqlEnum("vertical", ["trades", "appointments", "professional"]).notNull(),
  // Business details
  services: json("services").$type<string[]>(),
  serviceArea: json("serviceArea").$type<string[]>(),
  primaryCTA: varchar("primaryCTA", { length: 64 }),
  bookingLink: varchar("bookingLink", { length: 512 }),
  // Branding
  tagline: text("tagline"),
  brandColors: json("brandColors").$type<{ primary?: string; secondary?: string }>(),
  // Raw payload from onboarding
  rawPayload: json("rawPayload").$type<Record<string, unknown>>(),
  // Status workflow
  status: mysqlEnum("status", ["new", "review", "needs_info", "ready", "approved"]).default("new").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Intake = typeof intakes.$inferSelect;
export type InsertIntake = typeof intakes.$inferInsert;

/**
 * Build plans generated from intakes
 */
export const buildPlans = mysqlTable("build_plans", {
  id: int("id").autoincrement().primaryKey(),
  intakeId: int("intakeId").notNull(),
  // Template selection
  templateId: varchar("templateId", { length: 64 }).notNull(),
  // Generated plan JSON
  plan: json("plan").$type<{
    pages: Array<{ id: string; title: string; slug: string; sections: unknown[] }>;
    brand: { primaryColor: string; secondaryColor: string; fontFamily: string };
    copy: { heroHeadline: string; heroSubheadline: string; ctaText: string };
    features: string[];
  }>(),
  // Status
  status: mysqlEnum("status", ["draft", "needs_info", "ready", "approved", "deployed"]).default("draft").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type BuildPlan = typeof buildPlans.$inferSelect;
export type InsertBuildPlan = typeof buildPlans.$inferInsert;

/**
 * Clarification requests for missing info
 */
export const clarifications = mysqlTable("clarifications", {
  id: int("id").autoincrement().primaryKey(),
  intakeId: int("intakeId").notNull(),
  // One-time token
  token: varchar("token", { length: 64 }).notNull().unique(),
  // Question details
  questionKey: varchar("questionKey", { length: 64 }).notNull(),
  questionText: text("questionText").notNull(),
  inputType: mysqlEnum("inputType", ["text", "select", "multitag"]).default("text").notNull(),
  options: json("options").$type<string[]>(),
  // Response
  answer: text("answer"),
  answeredAt: timestamp("answeredAt"),
  // Status
  status: mysqlEnum("status", ["pending", "answered", "expired"]).default("pending").notNull(),
  used: boolean("used").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  expiresAt: timestamp("expiresAt"),
});

export type Clarification = typeof clarifications.$inferSelect;
export type InsertClarification = typeof clarifications.$inferInsert;

/**
 * Deployment jobs
 */
export const deployments = mysqlTable("deployments", {
  id: int("id").autoincrement().primaryKey(),
  buildPlanId: int("buildPlanId").notNull(),
  intakeId: int("intakeId").notNull(),
  // Job status
  status: mysqlEnum("status", ["queued", "running", "success", "failed"]).default("queued").notNull(),
  // Output
  siteId: varchar("siteId", { length: 64 }),
  previewUrl: varchar("previewUrl", { length: 512 }),
  productionUrl: varchar("productionUrl", { length: 512 }),
  // Logs
  logs: json("logs").$type<string[]>(),
  errorMessage: text("errorMessage"),
  // Timestamps
  startedAt: timestamp("startedAt"),
  completedAt: timestamp("completedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Deployment = typeof deployments.$inferSelect;
export type InsertDeployment = typeof deployments.$inferInsert;
