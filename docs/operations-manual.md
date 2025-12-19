# LaunchBase Internal Operations Manual

> For operators who review, deploy, and support LaunchBase websites.

---

## Your Role

You're the human layer between AI-generated sites and live customer websites. Your job is to:

1. **Review** — Catch edge cases the AI missed
2. **Clarify** — Ask smart questions when info is incomplete
3. **Deploy** — Push approved sites live
4. **Support** — Handle post-launch requests

---

## Daily Responsibilities

### Morning Check (5 min)

1. Open Admin Dashboard (`/admin`)
2. Check "Awaiting Review" count
3. Review any overnight intakes
4. Prioritize by submission time (FIFO)

### Review Workflow

For each intake:

1. **Read the intake** — Business name, vertical, services, service area
2. **Check confidence score** — Scores < 70% require clarification before approval
3. **Review build plan** — Does the hero copy make sense? Is the CTA appropriate?
4. **Approve or clarify** — If anything is unclear, send a clarification request

### Quality Standards

Before approving, verify:

- [ ] Business name is spelled correctly
- [ ] Service area is accurate
- [ ] CTA matches the business type (trades = "Call Now", appointments = "Book Online")
- [ ] No placeholder text visible
- [ ] Contact info is complete

---

## Clarification Rules

### When to Request Clarification

- Confidence score < 70%
- Business description is vague or incomplete
- Service area is missing or unclear
- Contact preference doesn't match business type

### How to Ask Good Questions

**Bad:** "Can you provide more information?"

**Good:** "Do you want customers to call you directly or fill out a form?"

Keep questions:
- Short (one question per request)
- Specific (not open-ended)
- Actionable (easy to answer)

### Clarification Response Time

- Most clients respond within 24 hours
- If no response after 48 hours, send a gentle nudge
- After 7 days with no response, mark as "stale" and deprioritize

---

## Deployment Process

1. **Approve the build plan** — Click "Approve" in the review panel
2. **Start deployment** — Click "Deploy" to begin the process
3. **Monitor status** — Watch the deployment status page for completion
4. **Verify live site** — Open the live URL and do a quick visual check
5. **Notify client** — System sends automatic launch email

### Post-Deployment Checklist

- [ ] Site loads without errors
- [ ] Contact form works
- [ ] Phone number is clickable on mobile
- [ ] Images load properly
- [ ] No broken links

---

## Escalation Rules

### When to Escalate

| Issue | Action |
|-------|--------|
| Client requests major changes | Escalate to product team |
| Technical deployment failure | Escalate to engineering |
| Refund request | Escalate to support lead |
| Legal/compliance concern | Escalate immediately |

### How to Escalate

1. Document the issue in internal notes
2. Tag the appropriate team in Slack
3. Include intake ID and client contact info
4. Summarize the issue in 2-3 sentences

---

## Common Scenarios

### Scenario: Vague Business Description

**Client wrote:** "I do stuff for people"

**Action:** Send clarification request asking for specific services offered.

### Scenario: Missing Contact Info

**Client left phone blank**

**Action:** Check if they selected "Online form" as contact preference. If so, proceed. If not, request clarification.

### Scenario: Unusual Vertical

**Client is a niche business that doesn't fit trades/appointments/professional**

**Action:** Use best judgment to select closest vertical. Document in internal notes.

### Scenario: Client Wants Custom Feature

**Client asks for booking integration, payment processing, etc.**

**Action:** Politely explain this is outside current scope. Offer to note it for future consideration.

---

## Metrics You're Measured On

| Metric | Target |
|--------|--------|
| Review turnaround | < 24 hours |
| First-pass approval rate | > 60% |
| Clarification rate | < 20% |
| Client satisfaction | > 4.5/5 |

---

## Tools & Access

- **Admin Dashboard:** `/admin`
- **Analytics:** `/admin/analytics`
- **Database:** Available in Management UI → Database panel

---

## Contact

Questions? Reach out to the product team via Slack or email.

---

*Last updated: December 2024*
