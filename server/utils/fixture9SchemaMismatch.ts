/**
 * Fixture 9: ORM Schema Typing Mismatch
 * Error: Property 'fullName' does not exist on type
 */

import { pgTable, text, serial } from "drizzle-orm/pg-core";

const users = pgTable("users", {
  id: serial("id").primaryKey(),
  firstName: text("first_name"),
  lastName: text("last_name"),
});

export function getUserName(user: typeof users.$inferSelect) {
  // Error: fullName doesn't exist in schema
  return user.fullName;
}
