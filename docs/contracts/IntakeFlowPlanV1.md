# IntakeFlowPlanV1 Contract

**Version:** 1.0  
**Status:** Active  
**Last Updated:** January 18, 2026

## Purpose

This contract defines the structure, behavior, and testing requirements for the LaunchBase intake flow (`/apply`). The intake flow is the primary entry point for new customers and must remain stable, predictable, and regression-free.

## Core Principles

1. **Contract-Driven:** Apply.tsx follows a multi-step wizard pattern with defined steps, validation rules, and submission payload structure
2. **Single Source of Truth:** Engine definitions live in `client/src/data/engines.ts` and are imported by both Pricing.tsx and Apply.tsx
3. **Smoke Test Required:** `pnpm smoke:intake` must pass before any checkpoint or deployment
4. **Truth-Safe Copy:** All tier and engine descriptions must match the Pricing page—no invented claims or marketing hype

## Flow Structure

### Steps (in order)

1. **Language** - Select preferred language (en/es/pl)
2. **Tier Selection** - Choose Standard/Growth/Premium with credits display
3. **Business** - Select vertical and industry
4. **Location** - Enter city/ZIP and service radius
5. **Burden** - Select what customer wants to hand off
6. **Involvement** - Choose communication preference
7. **Timing** - When to start
8. **Contact** - Name, email, phone
9. **Engines (Optional)** - Select add-on engines (Inbox/Phone/Social/Ads/Books)
10. **Review** - Confirm all selections and accept terms

### Tier Definitions

| Tier | Credits | Best For | What You Get |
|------|---------|----------|--------------|
| **Standard** | 1 credit | One focused improvement pass | • Clearer hero + single primary CTA<br>• Stronger section order + messaging hierarchy<br>• Mobile cleanup + quick conversion polish |
| **Growth** | 3 credits | Conversion-focused iteration and refinement | • Proof + trust layer upgrades (reviews, guarantees, clarity)<br>• CTA placement + funnel tightening<br>• 3 improvement loops to refine outcomes |
| **Premium** | 10 credits | Full transformation + deeper iteration | • Strongest design system + page-wide consistency<br>• Full funnel rebuild + structure improvements<br>• 10 loops for aggressive refinement |

**Credit Definition:** Each time a customer hits "Request changes" on their preview, it uses 1 credit.

### Engine Definitions

Engines are optional add-ons sourced from `client/src/data/engines.ts`:

- **Inbox Engine** - Email setup + deliverability
- **Phone Engine** - Call forwarding/routing
- **Social Engine** - Weekly auto-post schedule
- **Ads Engine** - Google Ads starter campaign
- **Books Engine** - QuickBooks connection

## Database Schema

### `intakes` Table

Required fields for submission:

```typescript
{
  businessName: string;
  contactName: string;
  email: string;
  phone: string;
  audience: "biz" | "org";
  websiteStatus: "none" | "existing" | "systems_only";
  vertical: "trades" | "appointments" | "professional";
  tier: "standard" | "growth" | "premium" | null;
  enginesSelected: string[]; // Array of engine IDs: ["inbox", "ads", etc.]
}
```

## Validation Rules

### Per-Step Validation

- **Language:** Must select a language
- **Tier Selection:** Must select a tier (standard/growth/premium)
- **Business:** Must select a vertical
- **Location:** cityZip must be ≥3 chars, radiusMiles must be ≥5
- **Burden:** Must select at least one burden
- **Involvement:** Must select involvement level
- **Timing:** Must select start timing
- **Contact:** Name ≥2 chars, email must contain "@", phone ≥7 chars
- **Engines:** Optional (no validation required)
- **Review:** Must accept terms

### Submission Validation

Backend must validate:
- All required fields present
- Tier is one of: standard, growth, premium
- enginesSelected is an array (can be empty)
- All engine IDs in enginesSelected exist in engines.ts

## UI Requirements

### Mobile-First

- No horizontal scrolling
- All tier pricing + credits visible without expanding
- Touch targets ≥44px height
- Progressive disclosure for engine details (use `<details>` element)

### State Management

- Form state persists to localStorage (key: `launchbase_apply_draft_v3`)
- Dev-only: stepIndex persists to sessionStorage to survive hot reloads
- Checkbox handlers use `event.checked` (not derived state) to avoid batching races

### Error Handling

- Unknown engine IDs trigger `console.warn()` in Review step
- Missing data shows validation errors inline
- Network errors display user-friendly messages

## Testing Requirements

### Smoke Test: `pnpm smoke:intake`

**Location:** `scripts/smoke/smokeIntakeFlow.mjs`

**What it tests:**
1. Insert test intake with tier=premium and enginesSelected=["inbox", "ads"]
2. Verify database persistence (tier and enginesSelected array)
3. Verify no silent failures or data loss
4. Clean up test data

**Success criteria:**
- Test passes with exit code 0
- Both engines persist correctly as JSON array
- No crashes or validation errors

### CI Integration

The smoke test must run in CI alongside other smoke tests:

```bash
pnpm smoke:intake
```

**Failure policy:** If smoke test fails, the build must fail. No exceptions.

## Change Policy

Changes to this contract require:

1. **Patch version** (1.0 → 1.0.1): Copy updates, minor UI tweaks, bug fixes
2. **Minor version** (1.0 → 1.1): New optional steps, new engines, new tiers
3. **Major version** (1.0 → 2.0): Breaking changes to flow structure, schema, or validation rules

All changes must:
- Update this document
- Pass `pnpm smoke:intake`
- Include migration guide if breaking

## Dependencies

### Shared Modules

- `client/src/data/engines.ts` - Single source of truth for engine definitions
- `drizzle/schema.ts` - Database schema for intakes table

### Related Pages

- `/pricing` - Must match tier descriptions and credits
- `/how-it-works` - Should explain tier + engines selection flow

## Maintenance

### Weekly Review

- Check smoke test pass rate
- Review intake submission errors (backend logs)
- Validate tier/engine copy matches Pricing page

### Quarterly Audit

- Review tier pricing and credits (adjust if needed)
- Check for new engine requests (add to engines.ts)
- Verify mobile UX on real devices

## Appendix: Historical Context

**Why this contract exists:**

The intake flow had a UI-state bug where the Review step only showed the first selected engine even though the database received both engines correctly. This was caused by a React batching race in the checkbox handler. The fix:

1. Use `event.checked` instead of derived `isSelected` state
2. Add unknown engine ID warning in Review step
3. Add dev-only sessionStorage persistence for stepIndex
4. Create E2E smoke test to prevent regressions

**Lesson learned:** UI bugs that don't affect data persistence are still worth fixing because they make the app feel fragile. Smoke tests prevent spirals.

---

**Contract Owner:** LaunchBase Platform Team  
**Review Cadence:** Quarterly or when major changes proposed  
**Last Reviewed:** January 18, 2026
