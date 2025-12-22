# LaunchBase Suite — Module Setup Checklists

> **Philosophy:** Customers already gave you their core info during intake. Each module only asks for **incremental info** specific to that module.

---

## What You Already Know (From Intake)

Every customer has already provided:
- ✅ Business name
- ✅ Contact email & phone
- ✅ Services offered
- ✅ Service area / location
- ✅ Brand voice / tone preferences
- ✅ Primary CTA preference

**This info is shared across all modules. Never ask for it again.**

---

## Module 1: Social Media Intelligence

**Tagline:** "Automated posts that feel human, timed to what matters locally."

### Pricing
| Item | Price |
|------|-------|
| Setup Fee | $249 |
| Monthly (Low Cadence) | $79/mo |
| Monthly (Medium Cadence) | $129/mo |
| Monthly (High Cadence) | $199/mo |
| Sports & Events Layer | +$29/mo |
| Community & Schools Layer | +$39/mo |
| Local Trends Layer | +$49/mo |

### Additional Info Needed
- Facebook Page access (OAuth)
- Posting preferences (times, frequency)
- Photo library (optional)

### Customer Setup Steps

| Step | Title | What Customer Does | Time |
|------|-------|-------------------|------|
| 1 | Connect Facebook Page | Click 'Connect Facebook' and authorize LaunchBase | ~2 min |
| 2 | Set Posting Preferences | Choose posting times and quiet hours | ~3 min |
| 3 | Review First Post | Approve, edit, or request changes to sample post | ~5 min |

**Total Setup Time:** ~10 minutes

### What LaunchBase Does
- Securely stores Page access
- Configures posting schedule
- Generates sample posts based on current conditions
- Never posts without approval (in Guided mode)

---

## Module 2: QuickBooks Sync

**Tagline:** "Quotes → Invoices → Payments → Tax records. Almost no admin."

### Pricing
| Item | Price |
|------|-------|
| Setup Fee | $499 |
| Monthly | $79/mo |

### Additional Info Needed
- QuickBooks Online login (OAuth)
- Chart of accounts mapping
- Invoice template preferences
- Payment terms (Net 15, Net 30, etc.)

### Customer Setup Steps

| Step | Title | What Customer Does | Time |
|------|-------|-------------------|------|
| 1 | Connect QuickBooks | Click 'Connect QuickBooks' and sign in | ~3 min |
| 2 | Map Chart of Accounts | Review suggested mappings, adjust if needed | ~5 min |
| 3 | Import Customers *(optional)* | Confirm which customers to import | ~2 min |
| 4 | Set Up Invoice Template | Choose payment terms, review preview | ~5 min |

**Total Setup Time:** ~15 minutes

### What LaunchBase Does
- Securely connects to QuickBooks
- Auto-detects existing accounts
- Pulls customer list and syncs with CRM
- Applies branding to invoices
- Never modifies data without approval

---

## Module 3: Google Business Assistant

**Tagline:** "Reviews answered. Listings optimized. Local SEO handled."

### Pricing
| Item | Price |
|------|-------|
| Setup Fee | $249 |
| Monthly | $49/mo |

### Additional Info Needed
- Google Business Profile access (OAuth)
- Review response preferences
- Business hours (if different from intake)

### Customer Setup Steps

| Step | Title | What Customer Does | Time |
|------|-------|-------------------|------|
| 1 | Connect Google Business | Click 'Connect Google' and authorize | ~3 min |
| 2 | Set Review Preferences | Choose response style and approval mode | ~3 min |
| 3 | Verify & Optimize Listing | Review optimization suggestions, approve changes | ~5 min |

**Total Setup Time:** ~11 minutes

### What LaunchBase Does
- Securely connects to Google Business Profile
- Syncs current listing information
- Drafts review responses matching brand voice
- Audits listing and suggests improvements
- Never posts without approval

---

## Progress Tracking

Each module shows:
- **Progress bar** with percentage complete
- **Steps completed** (e.g., "2 of 3 steps completed")
- **Time remaining** (e.g., "~5 min remaining")
- **Next step** highlighted with "Start This Step" button

### Status Badges
- 🔒 **Complete setup to activate** — Module purchased but setup incomplete
- ✨ **Active** — Module fully set up and running

---

## Customer Dashboard View

```
┌─────────────────────────────────────────────────┐
│ Social Media Intelligence          ██████░░ 67% │
│ ✓ Connected Facebook Page                       │
│ ✓ Set posting preferences                       │
│ ○ Review first scheduled post                   │
├─────────────────────────────────────────────────┤
│ QuickBooks Sync                    ████░░░░ 50% │
│ ✓ Connected QuickBooks                          │
│ ✓ Mapped chart of accounts                      │
│ ○ Import existing customers                     │
│ ○ Set up invoice templates                      │
├─────────────────────────────────────────────────┤
│ Google Business Assistant          ░░░░░░░░  0% │
│ ○ Connect Google Business Profile               │
│ ○ Set review response preferences               │
│ ○ Verify & optimize listing                     │
└─────────────────────────────────────────────────┘
```

---

## Implementation Notes

### Database Tables
- `module_setup_steps` — Tracks completion status per user per module
- `module_connections` — Stores OAuth tokens and external service connections

### tRPC Endpoints
- `moduleSetup.getSteps` — Get all steps for a module
- `moduleSetup.getProgress` — Get progress for all modules
- `moduleSetup.completeStep` — Mark a step as complete
- `moduleSetup.initializeModule` — Create setup steps when module is purchased

### Analytics Events
- `module_step_completed` — When customer completes a setup step
- `module_setup_initialized` — When module setup begins
- `module_connected` — When OAuth connection succeeds
- `module_disconnected` — When customer disconnects a service

---

## Key Principles

1. **One intake, many modules** — Core info collected once, reused everywhere
2. **Incremental only** — Each module asks only for what's new
3. **Progress visibility** — Customers always know where they are
4. **Time estimates** — Set expectations, reduce anxiety
5. **Guided activation** — Clear next step, one at a time
