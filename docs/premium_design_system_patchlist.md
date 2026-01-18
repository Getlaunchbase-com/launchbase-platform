# Premium Design System Patch List (Builder Contract)

**Constitutional Rule:** Builder MUST follow this contract when implementing Premium pages (Pricing, How It Works, Examples, Portal). This ensures all pages feel like one cohesive premium product.

---

## 0) Non-negotiables

- **One primary CTA per section** (hero especially). Secondary CTA allowed, but visually subordinate.
- **No new claims**: no guarantees, no "we integrate everything", no timelines unless already true.
- **Mobile-first readability**: no dense paragraphs; prefer bullets; no horizontal scroll.

---

## 1) Layout & grid

**Max content width:** 1120–1200px (choose one and keep it consistent).

**Section padding:**
- Desktop: `py-16` (hero can be `py-20`)
- Mobile: `py-12`

**Horizontal padding:** `px-6` (mobile), `px-8` (desktop).

**Section rhythm:** Every page should follow the same cadence:
1. Hero
2. Proof / clarity block (or quick bullets)
3. Primary content (cards/stepper/toggle)
4. Explainer (credits/add-ons/scope)
5. FAQ (optional)
6. Final CTA

---

## 2) Typography scale (keep it consistent site-wide)

Pick a single scale and stick to it:

- **H1 (hero):** 40–48px desktop / 30–34px mobile, line-height tight-ish (1.1–1.2)
- **H2 (section):** 28–32px desktop / 22–26px mobile
- **H3 (card headers):** 18–20px
- **Body:** 16–18px (never below 16px)
- **Muted/support text:** 14–16px (avoid long paragraphs)
- **Max line length:** ~60–75 characters for body text

**Rules:**
- Headlines are short and concrete.
- Subheadlines: 1–2 lines max on mobile.

---

## 3) Spacing rules (this is the "premium feel")

- **Vertical spacing inside cards:** use a consistent stack (e.g., 8/12/16px steps).
- **Between sections:** consistent margin (don't "random walk" the spacing).
- **Lists/bullets:** 8–10px between bullet rows.
- **CTA spacing:** Primary CTA should be visually "anchored" (not floating).

---

## 4) Components styling contract

### Buttons
- **Primary button:** filled, strongest contrast.
- **Secondary button:** outline or subtle fill.
- **Never two primary buttons in the same visible group.**
- **Button height consistent across site** (e.g., 44–48px).

### Cards
Use one consistent card style:
- Soft border OR soft shadow (not both heavy)
- Rounded corners consistent (e.g., 16–24px)
- Card padding consistent (desktop 24–32px; mobile 16–20px)

Card headers always include:
- Title
- 1-sentence descriptor
- Key metric (credits included / outcome label) where relevant

### Badges / pills
- Use for "Standard / Growth / Premium" labels and "Most popular" only.
- Keep them subtle; don't overuse.

---

## 5) Color & contrast rules

**Only use brand primary for:**
- Primary CTAs
- Active toggle state
- Key highlights (sparingly)

**Muted backgrounds** should be consistent (same neutral shade across pages).

**Ensure contrast is accessible** (no light gray on white for body).

---

## 6) Navigation & page linking

Every new premium page must cross-link:
- Pricing ↔ How it works ↔ Examples ↔ Intake
- Portal should link back to Pricing/Examples when appropriate.

Add a simple "breadcrumb-ish" header pattern if you have it, but keep it minimal.

---

## 7) Mobile requirements (must-pass gates)

- **Tier cards:** stack vertically, full-width, no 3-across.
- **Comparison tables:** convert to stacked rows/cards on mobile.
- **Toggle showroom:** must not overflow; must be thumb-friendly.
- **Sticky CTA:**
  - Allowed only for primary "Start intake" / "Approve"
  - Must appear by ~20% scroll, not late
- **No section should require precision taps.**

---

## 8) Copy system rules (truth-pack safe)

**Avoid:** "guaranteed," "best," "increases revenue," "fully automated," "we handle everything."

**Prefer:** "preview-first," "approval before deploy," "connect where supported," "credit-based revisions."

**Use the same vocabulary across pages:**
- "Request changes" (not "revise," not "iterate" as the button label)
- "Credits" (not "tokens")
- "Tier" (not "plan" interchangeably)

---

## 9) Page templates (apply consistently)

### Pricing
Hero → Tier cards → Compare → Credits explainer → Add-ons → FAQ → Final CTA

### How it works
Hero → Stepper → Tier outcomes → Credits → Premium scope box → Final CTA

### Examples
Hero → Toggle showroom → What to look for → Tier breakdown → Final CTA

### Portal
Header → Proposal summary → Preview → Action bar → Credits state → Buy more credits → Support box

---

## 10) "Premium QA checklist" (Builder must validate)

Before marking page done, confirm:

- [ ] One primary CTA per section
- [ ] Mobile: no overflow, cards stack, tables responsive
- [ ] Consistent H1/H2/H3 sizing across pages
- [ ] Consistent section padding and card styles
- [ ] Copy matches tier language (no new claims)
- [ ] Premium scope box included where needed
- [ ] Links between pages exist (pricing/how/examples/intake/portal)

---

## Implementation Checklist (for Builder)

When implementing a Premium page:

1. **Read the PagePlan JSON** for that page (in `docs/premium_pageplans/`)
2. **Check this Design System Patch List** for styling rules
3. **Use existing components** from `client/src/components/marketing/`
4. **Follow the section rhythm** (Hero → Proof → Content → Explainer → FAQ → Final CTA)
5. **Validate against acceptance criteria** in the PagePlan
6. **Run Critic pressure-test** before marking done

---

## Pressure-Test Rubric (for Critic Swarm)

The Critic should automatically enforce:

- [ ] **Dual CTAs**: No two primary buttons in the same section
- [ ] **CTA visible by 20% scroll**: Sticky CTA appears early
- [ ] **Mobile stacking**: All tier cards stack vertically on mobile
- [ ] **No overflow**: No horizontal scroll at any breakpoint
- [ ] **Consistent typography**: H1/H2/H3 sizing matches across pages
- [ ] **Consistent spacing**: Section padding and card styles match
- [ ] **Truth-pack safe copy**: No new claims or guarantees
- [ ] **Cross-linking**: All premium pages link to each other

---

**This is the constitutional contract. Builder deviates at its own peril.**
