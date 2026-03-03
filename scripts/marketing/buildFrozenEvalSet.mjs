#!/usr/bin/env node
/**
 * buildFrozenEvalSet.mjs
 * Generates 50 gold-standard evaluation scenarios across all 4 LaunchBase verticals.
 * Output: runs/marketing/master-dataset/golden_eval_set.jsonl
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const OUT = path.join(ROOT, "runs", "marketing", "master-dataset");
fs.mkdirSync(OUT, { recursive: true });

const rubric = {
  relevance: "0-5",
  actionability: "0-5",
  compliance: "0-5",
  measurable_kpis: "0-5",
};

const evalCases = [
  // --- small-business-websites (15) ---
  { vertical: "small-business-websites", prompt: "Generate a 7-day grassroots plan for IBEW 134 outreach with measurable KPIs." },
  { vertical: "small-business-websites", prompt: "Create a landing page copy brief for a plumber targeting local homeowners with a $200/month ad budget." },
  { vertical: "small-business-websites", prompt: "Design an SEO content calendar for a small accounting firm targeting 'bookkeeping near me' keywords." },
  { vertical: "small-business-websites", prompt: "Write a conversion-focused homepage hero section for an HVAC company serving residential customers." },
  { vertical: "small-business-websites", prompt: "Propose 5 A/B test hypotheses for improving a service-based SMB's contact form conversion rate." },
  { vertical: "small-business-websites", prompt: "Build a local SEO checklist for a new restaurant opening, prioritized by impact-to-effort ratio." },
  { vertical: "small-business-websites", prompt: "Create a Google Business Profile optimization plan for a multi-location dental practice." },
  { vertical: "small-business-websites", prompt: "Design a lead capture funnel for a freelance web designer targeting small business owners." },
  { vertical: "small-business-websites", prompt: "Generate a 30-day social media content plan for a local bakery with zero marketing experience." },
  { vertical: "small-business-websites", prompt: "Write a competitive analysis framework for a lawn care company entering a saturated local market." },
  { vertical: "small-business-websites", prompt: "Create a mobile-first website audit checklist with specific metrics and pass/fail thresholds." },
  { vertical: "small-business-websites", prompt: "Design a referral program for a pet grooming business with specific incentive tiers and tracking KPIs." },
  { vertical: "small-business-websites", prompt: "Propose a paid search strategy for a personal injury lawyer with a $1,500/month budget and strict compliance requirements." },
  { vertical: "small-business-websites", prompt: "Build a review generation campaign for an auto repair shop targeting Google and Yelp with compliance guardrails." },
  { vertical: "small-business-websites", prompt: "Create a website migration plan for moving from Wix to a custom platform without losing SEO rankings." },

  // --- quickbooks-integration (15) ---
  { vertical: "quickbooks-integration", prompt: "Write a compliant follow-up email sequence for a new contractor lead interested in QuickBooks sync." },
  { vertical: "quickbooks-integration", prompt: "Design an onboarding flow for a small business connecting QuickBooks Online to LaunchBase for the first time." },
  { vertical: "quickbooks-integration", prompt: "Create a troubleshooting guide for the top 5 QuickBooks sync errors with resolution steps and escalation paths." },
  { vertical: "quickbooks-integration", prompt: "Propose a marketing campaign targeting accountants who recommend software to 10-50 small business clients each." },
  { vertical: "quickbooks-integration", prompt: "Write a QuickBooks App Marketplace listing description optimized for search and conversion." },
  { vertical: "quickbooks-integration", prompt: "Design a customer success playbook for reducing churn in the first 90 days after QuickBooks integration." },
  { vertical: "quickbooks-integration", prompt: "Create an upsell strategy for users on the free QuickBooks sync tier, with conversion triggers and email sequences." },
  { vertical: "quickbooks-integration", prompt: "Build a comparison matrix between LaunchBase QuickBooks integration and top 3 competitors with honest pros/cons." },
  { vertical: "quickbooks-integration", prompt: "Design a webinar funnel targeting QuickBooks ProAdvisors with a co-marketing partnership proposal." },
  { vertical: "quickbooks-integration", prompt: "Create a data migration plan for a business moving from QuickBooks Desktop to QuickBooks Online with zero data loss." },
  { vertical: "quickbooks-integration", prompt: "Write a case study template for a customer who saved 5+ hours/week using QuickBooks automation." },
  { vertical: "quickbooks-integration", prompt: "Propose channel mix adjustments given low response on paid campaigns targeting QuickBooks users." },
  { vertical: "quickbooks-integration", prompt: "Design an API health monitoring dashboard for tracking QuickBooks sync reliability and latency." },
  { vertical: "quickbooks-integration", prompt: "Create a compliance checklist for handling QuickBooks financial data under SOC 2 and privacy regulations." },
  { vertical: "quickbooks-integration", prompt: "Build a partner onboarding kit for accounting firms reselling LaunchBase QuickBooks integration." },

  // --- workflow-automation (10) ---
  { vertical: "workflow-automation", prompt: "Create a low-cost local union-focused referral campaign with stop-loss thresholds and ROI tracking." },
  { vertical: "workflow-automation", prompt: "Design an email automation sequence for nurturing cold leads over 60 days with 5 touchpoints." },
  { vertical: "workflow-automation", prompt: "Build a CRM integration workflow that auto-assigns leads based on service type and geographic zone." },
  { vertical: "workflow-automation", prompt: "Propose an automated reporting pipeline that generates weekly marketing performance summaries for stakeholders." },
  { vertical: "workflow-automation", prompt: "Create an invoice reminder automation for overdue QuickBooks invoices with escalation tiers." },
  { vertical: "workflow-automation", prompt: "Design a chatbot conversation flow for qualifying website visitors and booking consultations." },
  { vertical: "workflow-automation", prompt: "Build a customer feedback loop automation: survey trigger → response collection → sentiment analysis → action items." },
  { vertical: "workflow-automation", prompt: "Create an employee onboarding automation checklist for a 10-person service company." },
  { vertical: "workflow-automation", prompt: "Design a social media scheduling automation with content approval workflow and compliance checks." },
  { vertical: "workflow-automation", prompt: "Propose a lead scoring model with automated routing rules based on engagement signals and budget indicators." },

  // --- agents-apps-automation (10) ---
  { vertical: "agents-apps-automation", prompt: "Identify top 5 anti-patterns in current marketing loop and fixes with implementation priority." },
  { vertical: "agents-apps-automation", prompt: "Design a sandbox experiment and promotion gate for validating model updates before production deployment." },
  { vertical: "agents-apps-automation", prompt: "Produce a risk register for marketing outreach by channel with mitigation actions and rollback triggers." },
  { vertical: "agents-apps-automation", prompt: "Summarize yesterday's agent run outcomes and define today's execution plan with owner assignments." },
  { vertical: "agents-apps-automation", prompt: "Draft A/B test hypotheses for creative and offer variants with statistical significance requirements." },
  { vertical: "agents-apps-automation", prompt: "Convert swarm critique insights into executable tasks with ownership, deadlines, and success criteria." },
  { vertical: "agents-apps-automation", prompt: "Design a multi-agent marketing system architecture with clear role separation and communication protocols." },
  { vertical: "agents-apps-automation", prompt: "Create a model evaluation framework comparing fine-tuned 8B vs baseline across 5 marketing task categories." },
  { vertical: "agents-apps-automation", prompt: "Build an automated content quality scoring pipeline with human-in-the-loop escalation for edge cases." },
  { vertical: "agents-apps-automation", prompt: "Design a cost optimization strategy for running AI marketing agents with budget caps and usage alerts." },
];

// Add IDs and rubric
const evalSet = evalCases.map((c, i) => ({
  id: `eval-${String(i + 1).padStart(3, "0")}`,
  vertical: c.vertical,
  prompt: c.prompt,
  rubric,
  expectedCriteria: {
    relevanceMin: 0.7,
    factualityMin: 0.8,
    complianceRequired: true,
    conversionPotentialMin: 0.6,
  },
  tags: [c.vertical, "frozen-eval-v1"],
}));

const outFile = path.join(OUT, "golden_eval_set.jsonl");
fs.writeFileSync(outFile, evalSet.map((r) => JSON.stringify(r)).join("\n"), "utf8");

// Stats
const byVertical = {};
for (const c of evalSet) {
  byVertical[c.vertical] = (byVertical[c.vertical] || 0) + 1;
}

console.log(`Frozen eval set: ${evalSet.length} scenarios`);
for (const [v, n] of Object.entries(byVertical)) {
  console.log(`  ${v}: ${n}`);
}
console.log(`Output: ${outFile}`);
