/**
 * Phase A: Email Pipeline Smoke Test
 * 
 * Sends test emails to vmorre@live.com and vince@vincessnowplow.com
 * to verify Resend delivery works end-to-end.
 */

import { getDb } from "./server/db.js";
import { sendEmail } from "./server/email.js";
import { intakes } from "./drizzle/schema.js";
import { eq } from "drizzle-orm";

const recipients = [
  { email: "vmorre@live.com", name: "Vince" },
  { email: "vince@vincessnowplow.com", name: "Vince" }
];

async function main() {
  const db = getDb();
  
  console.log("🧪 Phase A: Email Pipeline Smoke Test\n");
  
  for (const recipient of recipients) {
    console.log(`📧 Sending to: ${recipient.email}`);
    
    // Create a temporary intake for this test
    const [intake] = await db.insert(intakes).values({
      email: recipient.email,
      contactName: recipient.name,
      businessName: "Email Smoke Test Co",
      vertical: "test",
      status: "new"
    }).$returningId();
    
    if (!intake?.id) {
      console.error(`❌ Failed to create intake for ${recipient.email}`);
      continue;
    }
    
    const intakeId = intake.id;
    console.log(`   Created intake ID: ${intakeId}`);
    
    // Send test email using intake_confirmation template
    const success = await sendEmail(intakeId, "intake_confirmation", {
      firstName: recipient.name,
      businessName: "Email Smoke Test Co",
      email: recipient.email
    });
    
    if (success) {
      console.log(`   ✅ Email sent successfully`);
    } else {
      console.log(`   ❌ Email send failed`);
    }
    
    console.log("");
  }
  
  console.log("\n📊 Verification Query:");
  console.log("Run this in your database to verify:");
  console.log(`
SELECT id, intakeId, emailType, recipientEmail, subject, status, sentAt
FROM email_logs
WHERE recipientEmail IN ('vmorre@live.com','vince@vincessnowplow.com')
ORDER BY sentAt DESC
LIMIT 20;
  `);
  
  console.log("\n📬 Inbox Check:");
  console.log("1. Check vmorre@live.com (Inbox vs Junk)");
  console.log("2. Check vince@vincessnowplow.com (Inbox vs Spam)");
  console.log("\nIf both arrive in Inbox → Phase A PASS ✅");
  console.log("If either in spam → Note it, but proceed (we'll fix DNS later)");
  
  process.exit(0);
}

main().catch(err => {
  console.error("❌ Smoke test failed:", err);
  process.exit(1);
});
