// Send preview email to Larre
import mysql from 'mysql2/promise';

const DATABASE_URL = process.env.DATABASE_URL;
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const BASE_URL = 'https://launchbase-h86jcadp.manus.space';

async function sendPreviewEmail() {
  const connection = await mysql.createConnection(DATABASE_URL);
  
  try {
    // Get Larre's intake
    const [intakes] = await connection.query(
      'SELECT * FROM intakes WHERE id = 120001'
    );
    
    if (intakes.length === 0) {
      console.log('Intake 120001 not found');
      return;
    }
    
    const intake = intakes[0];
    console.log('Found intake:', intake.businessName, intake.email);
    console.log('Preview token:', intake.previewToken);
    
    const previewUrl = `${BASE_URL}/preview/${intake.previewToken}`;
    const firstName = intake.contactName.split(' ')[0];
    
    // Send email via Resend
    const emailPayload = {
      from: 'LaunchBase <hello@launchbase.dev>',
      to: intake.email,
      subject: 'Your LaunchBase Preview is Ready',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #f97316;">Your Preview is Ready, ${firstName}!</h1>
          <p>Great news! We've built a custom website preview for your business.</p>
          <p>Click the button below to see exactly what we'll build for you:</p>
          <p style="text-align: center; margin: 30px 0;">
            <a href="${previewUrl}" style="background-color: #f97316; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold;">
              View Your Preview
            </a>
          </p>
          <p>If the button doesn't work, copy and paste this link:</p>
          <p style="color: #666; word-break: break-all;">${previewUrl}</p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
          <p style="color: #666; font-size: 14px;">
            Questions? Just reply to this email.<br>
            — The LaunchBase Team
          </p>
        </div>
      `,
    };
    
    console.log('Sending email to:', intake.email);
    
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(emailPayload),
    });
    
    const result = await response.json();
    
    if (response.ok) {
      console.log('Email sent successfully!');
      console.log('Email ID:', result.id);
      
      // Log the email in email_logs
      await connection.query(
        `INSERT INTO email_logs (intakeId, emailType, recipient, sentAt, createdAt)
         VALUES (?, ?, ?, NOW(), NOW())`,
        [intake.id, 'ready_for_review', intake.email]
      );
      console.log('Email logged to database');
    } else {
      console.log('Email failed:', result);
    }
    
  } finally {
    await connection.end();
  }
}

sendPreviewEmail().catch(console.error);
