# Intelligence Implementation — Three Locked Additions

This document specifies the three critical additions to LaunchBase that lock in platform continuity, learning, and scale.

---

## 1. Silence Audit Trail (Phase 1 — Highest ROI)

### Purpose

Turn "nothing happened" into a visible service. Every silence decision is logged, classified, and surfaced so customers understand the value they're receiving.

### Database Table: `decision_logs`

```typescript
export const decisionLogs = mysqlTable("decision_logs", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  // Decision type
  decision: mysqlEnum("decision", ["post", "silence", "wait"]).notNull(),
  // Silence severity classification
  severity: mysqlEnum("severity", ["hard_block", "soft_block", "discretionary"]),
  // Reason for decision
  reason: varchar("reason", { length: 128 }).notNull(),
  // Context that triggered evaluation
  triggerContext: mysqlEnum("triggerContext", [
    "weather_storm",
    "weather_clear",
    "weather_extreme",
    "sports_event",
    "community_event",
    "local_trend",
    "seasonal",
    "manual",
    "scheduled"
  ]).notNull(),
  // Raw conditions that led to decision
  conditions: json("conditions").$type<Record<string, unknown>>(),
  // Which layers evaluated this
  layersEvaluated: json("layersEvaluated").$type<string[]>(),
  // Confidence score (0-100)
  confidenceScore: int("confidenceScore").default(0),
  // Intelligence version used
  intelligenceVersion: varchar("intelligenceVersion", { length: 16 }).default("v2.4.0").notNull(),
  // Link to generated post (if decision was "post")
  socialPostId: int("socialPostId"),
  // Timestamps
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
```

### Severity Classification

| Severity | Meaning | Example |
|----------|---------|---------|
| `hard_block` | Safety rule prevented post | Weather emergency, hazardous conditions |
| `soft_block` | Relevance threshold not met | No relevant events/trends today |
| `discretionary` | Cadence rules (already posted today) | Posting limit reached for cadence |

### Implementation

1. **In Intelligence Pipeline** — After step 7 (Decide), log the decision:
   ```typescript
   await db.insert(decisionLogs).values({
     userId,
     decision: "silence",
     severity: "hard_block",
     reason: "weather_unsafe",
     triggerContext: "weather_storm",
     conditions: { windSpeed: 45, advisory: "winter_storm" },
     layersEvaluated: ["weather"],
     confidenceScore: 100,
     intelligenceVersion: "v2.4.0",
     createdAt: new Date(),
   });
   ```

2. **In Admin Dashboard** — Add "Activity" tab that shows:
   - "3 hard blocks this month"
   - "5 discretionary silences"
   - "You were protected from 2 high-risk posts"

3. **In Customer Dashboard** — Show summary:
   - "Last decision: Silence (weather unsafe)"
   - "This month: 15 posts, 8 silences"

### Why This Matters

- **Legal protection** — Proves you followed safety rules
- **Customer retention** — Silence becomes visible service, not forgotten tool
- **Trust** — Customers see why you didn't post
- **Competitive advantage** — Competitors don't log silence

---

## 2. Approval Feedback Loop (Phase 2 — Learning Engine)

### Purpose

Capture customer feedback on every post decision. Use this to improve industry profiles, detect misaligned layers, and reduce rejection rates.

### Database Table: `approval_feedback`

```typescript
export const approvalFeedback = mysqlTable("approval_feedback", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  socialPostId: int("socialPostId").notNull(),
  // Action taken
  action: mysqlEnum("action", ["approved", "edited", "rejected"]).notNull(),
  // Feedback type (normalized enum)
  feedbackType: mysqlEnum("feedbackType", [
    "too_promotional",
    "wrong_tone",
    "not_relevant",
    "too_salesy",
    "timing_wrong",
    "content_inaccurate",
    "other"
  ]),
  // Freeform feedback
  freeformNote: text("freeformNote"),
  // If edited, capture the changes
  originalContent: text("originalContent"),
  editedContent: text("editedContent"),
  // Which layer(s) the feedback relates to
  relatedLayers: json("relatedLayers").$type<string[]>(),
  // Timestamps
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
```

### Implementation

1. **In Approval Flow** — When customer approves/rejects, capture:
   ```typescript
   await db.insert(approvalFeedback).values({
     userId,
     socialPostId,
     action: "rejected",
     feedbackType: "too_promotional",
     freeformNote: "Felt too salesy for our brand",
     relatedLayers: ["trends"],
     createdAt: new Date(),
   });
   ```

2. **In Admin Dashboard** — Show aggregate metrics:
   - "Sports posts: 40% rejection rate (high)"
   - "Community layer: 5% rejection rate (good)"
   - "Most common feedback: 'too_promotional' (23%)"

3. **In Intelligence Improvement** — Use feedback to:
   - Detect layers that need tuning
   - A/B test industry profiles
   - Identify tone mismatches

### Why This Matters

- **Continuous improvement** — You improve faster than competitors
- **Data-driven decisions** — Know which layers work, which don't
- **Reduced friction** — Fix problems before they cause churn
- **Competitive moat** — Each customer's feedback makes the system smarter

---

## 3. Industry Profile Versioning (Phase 3 — Scale Without Rework)

### Purpose

Move industry logic from code to declarative JSON. Enable safe rollouts, A/B testing, and instant new industry launches.

### Database Table: `industry_profiles`

```typescript
export const industryProfiles = mysqlTable("industry_profiles", {
  id: int("id").autoincrement().primaryKey(),
  // Industry identifier
  industry: varchar("industry", { length: 64 }).notNull(),
  // Profile version
  profileVersion: varchar("profileVersion", { length: 16 }).notNull(),
  // Context weights for decision making
  contextWeights: json("contextWeights").$type<{
    weather: number;
    sports: number;
    community: number;
    trends: number;
  }>().notNull(),
  // Safety gates that apply
  safetyGates: json("safetyGates").$type<string[]>().notNull(),
  // Tone guardrails
  toneGuardrails: json("toneGuardrails").$type<{
    conservative?: boolean;
    professional?: boolean;
    energetic?: boolean;
  }>(),
  // Allowed post types for this industry
  allowedPostTypes: json("allowedPostTypes").$type<string[]>().notNull(),
  // When this profile becomes effective
  effectiveFrom: timestamp("effectiveFrom").notNull(),
  // Migration strategy for existing customers
  migrationStrategy: mysqlEnum("migrationStrategy", ["auto", "opt_in", "frozen"]).default("auto").notNull(),
  // Description for internal use
  description: text("description"),
  // Status
  status: mysqlEnum("status", ["draft", "active", "deprecated"]).default("draft").notNull(),
  // Timestamps
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
```

### Example Profile: `bar_restaurant v1.2.0`

```json
{
  "industry": "bar_restaurant",
  "profileVersion": "v1.2.0",
  "contextWeights": {
    "weather": 0.2,
    "sports": 0.5,
    "community": 0.2,
    "trends": 0.1
  },
  "safetyGates": [
    "no_tragedy",
    "no_politics",
    "weather_gated"
  ],
  "toneGuardrails": {
    "professional": true,
    "energetic": true
  },
  "allowedPostTypes": [
    "GAME_DAY",
    "COMMUNITY_EVENT",
    "SEASONAL",
    "WEATHER_UPDATE"
  ],
  "effectiveFrom": "2026-01-15T00:00:00Z",
  "migrationStrategy": "auto",
  "description": "Optimized for bars/restaurants. Heavy sports focus, moderate community, minimal trends.",
  "status": "active"
}
```

### Migration Strategies

| Strategy | Behavior | Use Case |
|----------|----------|----------|
| `auto` | All customers auto-upgrade | Non-breaking improvements |
| `opt_in` | Customers choose to upgrade | Major changes, needs review |
| `frozen` | Customers stay on old version | Breaking changes, legacy support |

### Implementation

1. **In Intelligence Pipeline** — Load profile at runtime:
   ```typescript
   const profile = await db.query.industryProfiles.findFirst({
     where: and(
       eq(industryProfiles.industry, customer.industry),
       eq(industryProfiles.status, "active"),
       lte(industryProfiles.effectiveFrom, now())
     ),
     orderBy: desc(industryProfiles.profileVersion),
   });
   
   // Use profile.contextWeights in layer evaluation
   ```

2. **In Admin Dashboard** — Show version management:
   - "bar_restaurant: v1.2.0 (active, 245 customers)"
   - "v1.3.0 (draft, ready for testing)"
   - Rollout controls: "Migrate 10 customers to v1.3.0"

3. **In Sales** — New industry launches become trivial:
   - "Add new industry: plumber"
   - "Copy from trades profile v1.0.0"
   - "Adjust weights"
   - "Deploy in 30 minutes"

### Why This Matters

- **Scale without rework** — Add 100 industries without code changes
- **Safe improvements** — A/B test profiles, measure impact
- **Zero regression** — Old customers stay on old version if needed
- **Competitive advantage** — You improve faster, safer, cheaper

---

## Implementation Order

### Phase 1: Silence Audit Trail (Week 1)
- Add `decision_logs` table
- Log all decisions in Intelligence Pipeline
- Surface in Admin Activity tab
- Show in customer dashboard

**ROI:** Immediate. Reduces churn, proves value.

### Phase 2: Approval Feedback Loop (Week 2)
- Add `approval_feedback` table
- Capture feedback on every approval/rejection
- Build aggregate metrics dashboard
- Use feedback to improve profiles

**ROI:** High. Enables continuous improvement.

### Phase 3: Industry Profile Versioning (Week 3-4)
- Add `industry_profiles` table
- Refactor industry logic to JSON
- Build version management UI
- Test with 2-3 industries

**ROI:** Highest. Unlocks infinite scale.

---

## Success Metrics

| Metric | Target | Why |
|--------|--------|-----|
| Silence decisions logged | 100% | Proves explainability |
| Feedback capture rate | >80% | Enables learning |
| Profile versions deployed | 3+ | Proves safe rollouts |
| Customer churn reduction | -20% | Silence visibility helps |
| New industry launch time | <1 day | Profiles enable speed |

---

## Technical Notes

1. **All three tables are additive** — No changes to existing tables required
2. **Backward compatible** — Existing code works without modification
3. **Invisible until surfaced** — No UI changes needed initially
4. **Ready for immediate deployment** — Can go live as soon as tables are created

---

## Next Steps

1. Create migration for three tables
2. Implement logging in Intelligence Pipeline
3. Build admin dashboard views
4. Test with pilot customer
5. Measure impact and iterate

This is the foundation that turns LaunchBase from "impressive" into "inevitable."
