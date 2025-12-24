// Save Larre - Create intake from stuck suite_application ID 90001
import mysql from 'mysql2/promise';
import crypto from 'crypto';

const DATABASE_URL = process.env.DATABASE_URL;

async function saveLarre() {
  const connection = await mysql.createConnection(DATABASE_URL);
  
  try {
    // Get Larre's suite application
    const [apps] = await connection.query(
      'SELECT * FROM suite_applications WHERE id = 90001'
    );
    
    if (apps.length === 0) {
      console.log('Suite application 90001 not found');
      return;
    }
    
    const app = apps[0];
    console.log('Found suite application:', app.contactName, app.contactEmail);
    
    // Check if intake already exists
    if (app.intake_id) {
      console.log('Intake already exists:', app.intake_id);
      return;
    }
    
    // Map vertical
    const verticalMap = {
      trades: 'trades',
      health: 'appointments',
      beauty: 'appointments',
      food: 'trades',
      cannabis: 'trades',
      professional: 'professional',
      fitness: 'appointments',
      automotive: 'trades',
    };
    const intakeVertical = verticalMap[app.vertical] || 'trades';
    
    // Generate preview token
    const previewToken = `preview_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
    
    // Create the intake
    const [intakeResult] = await connection.query(
      `INSERT INTO intakes (
        businessName, contactName, email, phone, vertical, services, serviceArea,
        primaryCTA, status, previewToken, rawPayload, createdAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [
        app.contactName, // Use contact name as business name for now
        app.contactName,
        app.contactEmail,
        app.contactPhone,
        intakeVertical,
        JSON.stringify([app.industry?.replace(/_/g, ' ') || '']),
        JSON.stringify([app.cityZip]),
        'call',
        'ready_for_review',
        previewToken,
        JSON.stringify({
          source: 'suite_application',
          suiteApplicationId: app.id,
          language: app.language,
          cadence: app.cadence,
          mode: app.mode,
          layers: app.layers,
          pricing: app.pricing,
          startTiming: app.startTiming,
        }),
      ]
    );
    
    const intakeId = intakeResult.insertId;
    console.log('Created intake:', intakeId);
    console.log('Preview token:', previewToken);
    
    // Update suite application with intake ID
    await connection.query(
      'UPDATE suite_applications SET intake_id = ?, status = ? WHERE id = ?',
      [intakeId, 'approved', app.id]
    );
    console.log('Updated suite application with intake_id');
    
    // Log email that should be sent
    console.log('');
    console.log('=== EMAIL TO SEND ===');
    console.log('To:', app.contactEmail);
    console.log('Subject: Your LaunchBase Preview is Ready');
    console.log('Preview URL: /preview/' + previewToken);
    console.log('');
    console.log('Larre saved! Now need to send the preview email.');
    
  } finally {
    await connection.end();
  }
}

saveLarre().catch(console.error);
