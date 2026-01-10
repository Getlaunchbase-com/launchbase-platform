# LaunchBase – First 10 Async Bot Messages (Day 0–Day 3)

**Purpose:** Reduce thinking, force clear approval, keep momentum, avoid meetings, establish trust early

**Tone:** Calm, competent, respectful, not "chatty SaaS"

---

## Message 1 — Immediately After Payment

**Type:** Confirmation + Framing  
**Goal:** Reassure + set expectations

**Subject:** We're building your site — here's how this works

**Body:**

> Thanks — we've started building your site.
>
> Here's how the process works:
> • We'll propose defaults based on your business
> • You approve or tweak them by replying to emails
> • We apply changes immediately
> • No meetings unless you want one
>
> You'll get the first draft question shortly.

---

## Message 2 — Homepage Headline

**Type:** Question (Blocking)

**Subject:** Approve your homepage headline

**Body:**

> We've drafted your homepage headline:
>
> "Trusted Chicago General Contractor"
>
> Reply YES to approve
> or reply with an edit (you can rewrite it).

---

## Message 3 — Headline Confirmation

**Type:** Confirmation

**Subject:** Homepage headline approved

**Body:**

> ✅ Your homepage headline is now:
>
> "Trusted Chicago General Contractor"
>
> Next up: the short description under it.

---

## Message 4 — Subheadline / Value Statement

**Type:** Question (Blocking)

**Subject:** Approve your homepage description

**Body:**

> Here's the short description under your headline:
>
> Licensed, insured, and trusted for residential and commercial projects across Chicago.
>
> Reply YES to approve
> or reply with changes.

---

## Message 5 — Primary Call to Action

**Type:** Question (Blocking)

**Subject:** How should customers contact you?

**Body:**

> We've set your main call-to-action to:
>
> "Call Now"
>
> Your number will be prominently displayed.
>
> Reply YES to keep this
> or reply BOOKING if you prefer a booking link.

---

## Message 6 — Services Section

**Type:** Question (Blocking)

**Subject:** Confirm your listed services

**Body:**

> We've listed these services on your site:
>
> • General Contracting
> • Home Remodeling
> • Repairs & Maintenance
>
> Reply YES to approve
> or reply with additions/removals.

---

## Message 7 — Services Confirmation

**Type:** Confirmation

**Subject:** Services updated

**Body:**

> ✅ Your services section is locked in.
>
> Next up: Google Business Profile setup.

---

## Message 8 — Google Business Category

**Type:** Question (Blocking, Integration)

**Subject:** Google Business category approval

**Body:**

> For Google Business Profile, we recommend:
>
> Primary category: General Contractor
>
> This affects how you appear in Google Maps.
>
> Reply YES to approve
> or reply with a different category.

---

## Message 9 — Google Business Confirmation

**Type:** Confirmation

**Subject:** Google Business category set

**Body:**

> ✅ Google Business category approved.
>
> We're preparing the rest of your profile now.

---

## Message 10 — What's Next (Trust Builder)

**Type:** Status Update

**Subject:** What we're working on next

**Body:**

> Here's what's in progress:
>
> • Final homepage polish
> • Google Business completion
> • Social media setup (if selected)
>
> You'll only hear from us when approval is needed.
>
> You're always in control.

---

## 🔒 Why This Works

- Every question is single-purpose
- Replies can be one word
- Nothing is re-asked once approved
- Confidence builds without overwhelm
- This same pattern works forever (maintenance)

---

## Implementation Notes

**State Machine per Message:**
- PENDING → ASKED (email sent)
- ASKED → CUSTOMER_RESPONDED (reply received)
- CUSTOMER_RESPONDED → APPLIED (change made)
- APPLIED → CONFIRMED (confirmation sent)
- CONFIRMED → LOCKED (no re-asking)

**Reply Parsing:**
- YES/yes/y/approve/good/looks good → APPROVE
- NO/no/n/change/different → REQUEST_CHANGE
- Any other text → EDIT_PROVIDED
- Unclear/ambiguous → ESCALATE_TO_HUMAN

**Timing:**
- Message 1: Immediate (webhook trigger)
- Message 2: 2 hours after payment
- Messages 3-10: Send next question 1 hour after previous confirmation
- If no response after 24 hours: gentle nudge (not pushy)

**Autofill Sources:**
- Headline: `intake.businessName` + `intake.primaryTrade` + location
- Description: Generated from `intake.vertical` + `intake.serviceArea`
- Services: Parsed from `intake.rawPayload.services` or `intake.trades`
- Google category: Mapped from `intake.primaryTrade` to Google taxonomy
