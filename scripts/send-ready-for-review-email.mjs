import { sendEmail } from '../server/email.js';
import mysql from 'mysql2/promise';

const conn = await mysql.createConnection(process.env.DATABASE_URL);
const [rows] = await conn.query(
  'SELECT id, contactName, businessName, email, previewToken FROM intakes WHERE email = ? ORDER BY createdAt DESC LIMIT 1',
  ['e2e-test-jan5@launchbase-test.com']
);
await conn.end();

if (rows.length === 0) {
  console.log('ERROR: No intake found');
  process.exit(1);
}

const intake = rows[0];
console.log('Sending ready_for_review email to:', intake.email);
console.log('Intake ID:', intake.id);

const firstName = intake.contactName?.split(' ')[0] || 'there';
await sendEmail(intake.id, 'ready_for_review', {
  firstName,
  businessName: intake.businessName,
  email: intake.email,
  previewUrl: `/preview/${intake.previewToken}`,
});

console.log('Email sent successfully');
