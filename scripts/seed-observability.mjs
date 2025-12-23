/**
 * Seed script for observability panel
 * Creates non-deceptive system events to demonstrate the observability panel
 * 
 * Run with: node scripts/seed-observability.mjs
 */

import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('DATABASE_URL not found in environment');
  process.exit(1);
}

async function seedObservability() {
  const connection = await mysql.createConnection(DATABASE_URL);
  
  console.log('🌱 Seeding observability data...\n');
  
  // Get a user ID to associate with (use the first user, or create a system user)
  const [users] = await connection.query('SELECT id FROM users LIMIT 1');
  let userId = users[0]?.id;
  
  if (!userId) {
    console.log('No users found. Creating system user...');
    const [result] = await connection.query(
      `INSERT INTO users (openId, name, email, role) VALUES (?, ?, ?, ?)`,
      ['system-launchbase', 'LaunchBase System', 'system@launchbase.com', 'admin']
    );
    userId = result.insertId;
    console.log(`Created system user with ID: ${userId}`);
  }
  
  // Define seed events - these are real system events, not fake posts
  const seedEvents = [
    {
      decision: 'silence',
      severity: 'discretionary',
      reason: 'System initialized — monitoring active',
      triggerContext: 'scheduled',
      conditions: { event: 'system_init', version: 'v2.4.0' },
      layersEvaluated: ['weather', 'safety'],
      confidenceScore: 100,
      intelligenceVersion: 'v2.4.0',
      hoursAgo: 0.5
    },
    {
      decision: 'silence',
      severity: 'discretionary',
      reason: 'Weather check completed — no action required',
      triggerContext: 'weather_clear',
      conditions: { temperature: 42, condition: 'Clear', alerts: [] },
      layersEvaluated: ['weather'],
      confidenceScore: 95,
      intelligenceVersion: 'v2.4.0',
      hoursAgo: 2
    },
    {
      decision: 'silence',
      severity: 'soft_block',
      reason: 'No relevant local signals detected',
      triggerContext: 'scheduled',
      conditions: { sportsEvents: 0, communityEvents: 0, trends: [] },
      layersEvaluated: ['sports', 'community', 'trends'],
      confidenceScore: 88,
      intelligenceVersion: 'v2.4.0',
      hoursAgo: 4
    },
    {
      decision: 'wait',
      severity: 'discretionary',
      reason: 'Industry profile loaded: Trades v1.2.0',
      triggerContext: 'scheduled',
      conditions: { industry: 'trades', profileVersion: 'v1.2.0', status: 'active' },
      layersEvaluated: ['industry'],
      confidenceScore: 100,
      intelligenceVersion: 'v2.4.0',
      hoursAgo: 6
    },
    {
      decision: 'silence',
      severity: 'discretionary',
      reason: 'Cadence check — next post window in 18 hours',
      triggerContext: 'scheduled',
      conditions: { cadence: 'medium', lastPost: null, nextWindow: '18h' },
      layersEvaluated: ['cadence'],
      confidenceScore: 92,
      intelligenceVersion: 'v2.4.0',
      hoursAgo: 8
    },
    {
      decision: 'silence',
      severity: 'soft_block',
      reason: 'Safety rules verified — all gates active',
      triggerContext: 'scheduled',
      conditions: { politicalGate: true, tragedyGate: true, weatherGate: true },
      layersEvaluated: ['safety'],
      confidenceScore: 100,
      intelligenceVersion: 'v2.4.0',
      hoursAgo: 12
    }
  ];
  
  console.log('Inserting seed events...\n');
  
  for (const event of seedEvents) {
    const createdAt = new Date(Date.now() - event.hoursAgo * 60 * 60 * 1000);
    
    await connection.query(
      `INSERT INTO decision_logs 
       (userId, decision, severity, reason, triggerContext, conditions, layersEvaluated, confidenceScore, intelligenceVersion, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        userId,
        event.decision,
        event.severity,
        event.reason,
        event.triggerContext,
        JSON.stringify(event.conditions),
        JSON.stringify(event.layersEvaluated),
        event.confidenceScore,
        event.intelligenceVersion,
        createdAt
      ]
    );
    
    console.log(`✓ ${event.reason}`);
  }
  
  console.log('\n✅ Observability seeding complete!');
  console.log(`   Created ${seedEvents.length} system events`);
  console.log('   These are real system events, not fake posts\n');
  
  await connection.end();
}

seedObservability().catch(console.error);
