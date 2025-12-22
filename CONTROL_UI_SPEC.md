# LaunchBase Control UI Specification

**"Tune Your Visibility" + "Local Context Layers"**

This specification defines the customer-facing control interface for the Social Media Intelligence module. It is a thin, safe layer on top of the Intelligence Core that lets customers control how often and what kind of local context is referenced—without ever touching safety or decision logic.

---

## 1. Overview

The Control UI serves two purposes:

1. **Configuration** — Customers adjust their Intelligence Core configuration (cadence, layers, tone)
2. **Approval** — Customers review and approve generated posts before publishing

The UI is presentation-only. All logic remains in the Intelligence Core. The UI cannot break safety, override decisions, or force behavior.

---

## 2. Entry Points

### Primary Web Dashboard

**Location:** `/suite/social/controls`

This is the main hub for all Social Media Intelligence configuration and approval.

### Quick Access Points

- **Module card:** "Social Media Intelligence" module → "Manage" button
- **Post approval queue:** "Adjust settings" link (when customer dislikes a post)
- **Settings panel:** Quick toggles for cadence and layer intensity

### Mobile App (Upsell-Ready)

Same UI and controls, optimized for mobile layout. Push notifications for post approvals.

---

## 3. The Three Modes

Modes are **presentation-only**. They do not change the engine; they change how much control is exposed.

### Mode A: Auto (Default)

**Target:** Customers who want "set it and forget it"

**What they see:**
- LaunchBase recommended setup for their industry
- Settings are visible but mostly locked
- "Why this is recommended" explanation
- Cannot change cadence or layer weights

**What they can do:**
- View current configuration
- See sample posts
- Approve/reject individual posts

**Messaging:**
> "We've optimized settings for your industry. You focus on your business."

### Mode B: Guided

**Target:** Customers who want some control but trust recommendations

**What they see:**
- Cadence selector (Low/Medium/High)
- Layer intensity sliders (Low/Balanced/High)
- Guardrails and recommended defaults
- Clear "why this helps" explanations

**What they can do:**
- Adjust cadence
- Adjust layer intensity
- Still uses safety guardrails
- Approve/reject posts

**Messaging:**
> "Fine-tune how often and what we focus on. We keep you safe."

### Mode C: Custom (Advanced)

**Target:** Power users and businesses with specific needs

**What they see:**
- Full access to all layer sliders
- Seasonal boost toggles
- Detailed impact explanations
- Confirmation required: "I understand more activity = more posts + cost"

**What they can do:**
- Adjust all layers independently
- Enable seasonal boosts
- Set custom approval rules
- Access advanced analytics

**Messaging:**
> "Full control. You decide emphasis. We handle safety."

---

## 4. Core UI Layout

### Desktop Layout

The page is split into two sections: main content (left) and sticky pricing rail (right).

#### Left Column (Main Content)

**1. Current Status Panel**
- Green dot indicator: "Posting normally" or "Paused" or "Waiting for approval"
- Key stat: "Last post: 2 hours ago"
- Reminder: "Silence is valid. We don't post during unsafe conditions."

**2. Cadence Selector**
- Three radio cards: Low / Medium / High
- Each card shows:
  - Posts per week (1–2 / 2–3 / 4–6)
  - "Best for" line (e.g., "Steady presence, low overhead")
  - Monthly cost
- Selected card is highlighted

**3. Local Context Layers**
- Weather layer (always ON, locked with a lock icon)
- Each other layer has:
  - Toggle (Off/On)
  - When On: Intensity slider (Low / Balanced / High)
  - Impact label (Essential / High / Medium / Low)
  - One-liner: "Why it helps your business"

**Layers:**
- **Weather** (locked) — "Operational updates when it matters"
- **Sports & Events** — "Capitalize on game days and local events"
- **Community & Schools** — "Connect with local schools and colleges"
- **Local Trends** — "Join conversations your customers care about"

**4. Seasonal / Moment Boosts** (Custom mode only)
- Optional toggles for time-bound adjustments:
  - "Holiday mode" (Nov–Jan)
  - "Playoffs / big games" (sports-heavy weeks)
  - "Back to school" (Aug–Sept)
  - "Extreme weather focus" (winter)
- Each boost explains what it does and when it applies

**5. Sample Week Preview**
- Button: "See what this looks like"
- Modal shows 7 example posts based on current settings
- Includes: post text, context (weather/event), timestamp
- Lets customer see impact of their choices

**6. Save / Cancel**
- "Save changes" button (primary)
- "Cancel" button (secondary)
- Confirmation toast on save

#### Right Column (Sticky Pricing Rail)

Stays visible as customer scrolls. Shows:

- **Monthly total** (large, prominent)
- **One-time setup** (if applicable)
- **Posts/week estimate** (based on cadence)
- **Approval mode** (Auto-approve vs. Requires approval)
- **"What's included" collapsible** (expand to see layer details)
- **Overages policy** ("Blocked by default")
- **"Change anytime" badge** (reassurance)

### Mobile Layout

Same sections, stacked vertically:

1. Current Status Panel
2. Cadence Selector (full width)
3. Local Context Layers (full width)
4. Seasonal Boosts (if applicable)
5. Sample Week Preview (button)
6. Sticky bottom summary bar with "Save" button

Summary bar shows:
- Monthly total
- Posts/week estimate
- "Save" button

---

## 5. Controls (What Users Can Change)

### 5.1 Cadence (Frequency)

**UI:** Three radio cards

**Options:**
- **Low:** 1–2 posts/week
  - Best for: Steady presence, low overhead
  - Price: $79/mo
- **Medium:** 2–3 posts/week
  - Best for: Consistent engagement, balanced effort
  - Price: $129/mo
- **High:** 4–6 posts/week
  - Best for: Maximum visibility, active presence
  - Price: $199/mo

Each card shows the monthly cost.

### 5.2 Local Context Layers (Relevance)

**UI:** Toggles + intensity sliders

**Weather Layer (Always ON, Locked)**
- Cannot be disabled
- Icon: lock
- Explanation: "Safety first. We never post during hazardous weather."

**Sports & Events Layer**
- Toggle: Off / On
- When On: Slider (Low / Balanced / High)
- Impact: High (for bars, restaurants) / Medium (for others)
- Explanation: "Capitalize on game days and local events"

**Community & Schools Layer**
- Toggle: Off / On
- When On: Slider (Low / Balanced / High)
- Impact: Medium
- Explanation: "Connect with local schools and colleges"

**Local Trends Layer**
- Toggle: Off / On
- When On: Slider (Low / Balanced / High)
- Impact: Medium
- Explanation: "Join conversations your customers care about"

### 5.3 Moment Boosts (Custom Mode Only)

**UI:** Optional toggles (not sliders)

These are time-bound, customer-friendly adjustments:

- **Holiday mode** (Nov–Jan)
  - Increases community and seasonal relevance
  - "More posts about holiday shopping, events, closures"

- **Playoffs / Big Games** (sport-dependent)
  - Increases sports layer weight during playoffs
  - "More posts about big games and championship runs"

- **Back to School** (Aug–Sept)
  - Increases community layer weight
  - "More posts about school events and family activities"

- **Extreme Weather Focus** (winter)
  - Increases weather operational updates
  - "More posts about weather impacts on your business"

**Important:** These do NOT bypass safety. They adjust weights within the Intelligence Core's guardrails.

---

## 6. The Approval Experience

This is the "killer feature" that makes customers feel in control.

### Approval Queue

**Location:** `/suite/social/queue`

Shows pending posts in a queue (newest first).

**Each post card shows:**
- Post text (preview)
- Context (why it was generated: "Weather update", "Local event", "Trending topic")
- Scheduled time
- Three action buttons: Approve / Edit / Reject

### Approval Actions

**Approve**
- Post is scheduled for the configured time
- Confirmation: "Approved. Posting at [time]"

**Edit**
- Opens text editor
- Customer can modify the post
- Cannot change context or safety rules
- Saves as "customer edited"

**Reject**
- Post is discarded
- Feedback option: "Too promotional", "Wrong tone", "Not relevant"
- Feedback helps improve future posts

### Quick Rewrite Options

When customer rejects a post, offer:

- **"Make it more professional"** (1-click rewrite)
  - Adjusts tone without changing content
  - Uses professional voice guardrails

- **"Less [layer] next time"** (shortcut to settings)
  - Example: "Less sports next time" links to Controls page with Sports layer highlighted

---

## 7. Approval Mode Selection

### Option A: Approve Each Post (Recommended Default)

**What it means:**
- Every post appears in the approval queue
- Customer must approve before posting
- Takes 30 seconds per post

**Best for:**
- Customers who want full control
- Customers who are detail-oriented
- Customers building brand voice

**Warning:** None (this is the safe default)

### Option B: Auto-Approve

**What it means:**
- Posts publish automatically after generation
- No approval step
- Customer can still edit/delete after posting

**Availability:**
- Only after customer has approved 5+ posts
- Requires explicit opt-in
- Can be disabled anytime

**Warning (must be shown):**
> "LaunchBase may post without your review during storms, closures, or emergencies. We always follow safety rules, but you won't see the post first."

**Best for:**
- Experienced customers
- Customers who trust the system
- Customers who want maximum automation

---

## 8. Data Model (What We Store)

The UI writes only the declarative schema. Nothing else.

```json
{
  "customer_id": "...",
  "mode": "guided",
  "cadence": "medium",
  "layers": {
    "weather": "locked",
    "sports": "balanced",
    "community_schools": "low",
    "trends": "off"
  },
  "boosts": {
    "holiday_mode": true,
    "playoffs": false,
    "back_to_school": false,
    "extreme_weather": false
  },
  "approval_required": true,
  "tone": "professional",
  "intelligence_version": "v2.4.0",
  "updated_at": "2025-12-22T21:00:00Z"
}
```

**Important:**
- Engine reads this schema
- UI writes this schema
- Nothing else is stored
- No logic lives in this data
- All decisions are made by Intelligence Core

---

## 9. Pricing UX

Pricing must be crystal clear. Show the formula in the sticky rail.

### Pricing Components

**Cadence (base):**
- Low: $79/mo
- Medium: $129/mo
- High: $199/mo

**Layer Add-ons (per layer):**
- Sports & Events: +$29/mo
- Community & Schools: +$39/mo
- Local Trends: +$49/mo
- Weather: Included (locked)

**Setup Fees:**
- Base setup: $249 (one-time)
- Per-layer setup: $99 (one-time per layer)

### Example Pricing Display

```
Cadence (Medium)        $129/mo
Sports & Events         +$29/mo
Community & Schools     +$39/mo
─────────────────────────────
Monthly Total          $197/mo

Setup Fees
Base setup              $249
Sports setup            +$99
Community setup         +$99
─────────────────────────────
Total Setup             $447

Reassurance badges:
✓ Change anytime
✓ No contract
✓ Pause in off-season
```

### Messaging

- "Change anytime" — No commitment
- "No contract" — Cancel at any time
- "Pause in off-season" — Pause billing when not needed
- "Overages blocked by default" — Won't be surprised by extra charges

---

## 10. Mobile App Upsell

This is a perfect upsell because it's not "extra features"—it's less friction.

### App v1 Features (Simple + Valuable)

- **Push notification:** "Post ready to approve"
- **Approve/Edit/Reject** — Full approval workflow
- **Slider quick-adjust** — "Less sports, more holiday"
- **View last 30 posts** — See what's been posted
- **Performance metrics** — Engagement, reach, clicks

### Pricing

**+$19/mo per location** (easy add-on)

### Messaging

> "Approve posts on the go. Never miss a moment."

---

## 11. Build Order (Fastest Path)

1. **Controls page** (Auto/Guided/Custom + pricing rail)
   - Cadence selector
   - Layer toggles and sliders
   - Seasonal boosts
   - Sample preview modal
   - Pricing rail

2. **Approval queue page** (approve/edit/reject + rewrite buttons)
   - Post list
   - Action buttons
   - Quick rewrite options
   - Feedback collection

3. **"Adjust settings" shortcuts from queue**
   - Link from queue to controls page
   - Pre-highlight relevant layer

4. **Mobile app shell** (approve-only MVP)
   - Approval queue on mobile
   - Push notifications
   - Basic sliders

---

## 12. Key Design Principles

### Principle 1: Influence, Not Authority

Customers feel in control without being able to break things. Sliders adjust weights, not logic.

### Principle 2: Clarity Over Cleverness

Every control has a one-liner explaining why it helps. No jargon.

### Principle 3: Defaults Are Powerful

Auto mode is the default. Most customers never change it. That's success.

### Principle 4: Safety Is Invisible

Customers don't think about safety rules. They just work. Weather gating is locked, not explained.

### Principle 5: Pricing Is Transparent

Every control shows its cost. No surprises.

---

## 13. Implementation Checklist

- [ ] Create `/suite/social/controls` page
- [ ] Implement cadence selector (radio cards)
- [ ] Implement layer toggles and sliders
- [ ] Implement seasonal boost toggles
- [ ] Implement sample week preview modal
- [ ] Implement pricing rail
- [ ] Create `/suite/social/queue` page
- [ ] Implement post approval workflow
- [ ] Implement edit and rewrite buttons
- [ ] Implement feedback collection
- [ ] Create mobile-responsive layout
- [ ] Add mobile app shell (approval only)
- [ ] Write unit tests for all controls
- [ ] Write integration tests for approval workflow
- [ ] Create user documentation
- [ ] Create admin documentation

---

## 14. Success Metrics

- **Adoption:** % of customers who access Controls page
- **Engagement:** Avg. time spent in Controls page
- **Customization:** % of customers who change from Auto mode
- **Approval:** Avg. time to approve posts
- **Satisfaction:** NPS for Control UI feature

---

## Document History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2025-12-22 | Initial specification |

---

## Questions & Clarifications

**Q: Can customers create custom layers?**  
A: No. Layers are defined by the Intelligence Core. Customers adjust weight only.

**Q: What if a customer wants to disable weather gating?**  
A: They cannot. Weather gating is locked. It's a non-negotiable safety rule.

**Q: How do we handle seasonal boosts that don't apply to their industry?**  
A: The UI shows only relevant boosts. A snow removal business sees "Extreme weather focus" but not "Back to school".

**Q: Can customers see the Intelligence Core rules?**  
A: No. The Core is internal. Customers see outcomes and can adjust configuration.

**Q: What happens if a customer changes settings mid-week?**  
A: New posts use the new configuration. Old posts remain unchanged.
