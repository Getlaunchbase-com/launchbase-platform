# Service Selection Onboarding - Smoke Tests

## Overview
These tests validate the complete service selection flow from onboarding to Stripe checkout to admin view.

## Prerequisites
- Stripe test mode enabled
- Test credit card: `4242 4242 4242 4242` (any future expiry, any CVC)
- Admin access to view intake details

---

## Scenario A: Core Only (Website + Email)

### Steps
1. Navigate to `/onboarding` (click "Hand It Off")
2. Complete Steps 1-7 with valid business information
3. On Step 8 (Service Selection):
   - Select "CUSTOMER" experience mode
   - Check **Website** (Email should auto-check)
   - Leave all other services unchecked
4. On Step 9 (Pricing Summary):
   - Verify setup total: **$598.00** ($499 Website + $99 Email)
   - Verify monthly total: **$68.00** ($49 + $19)
   - Click "Confirm & Continue to Payment"
5. On Stripe Checkout:
   - Verify line items show Website Setup ($499) and Email Setup ($99)
   - Complete payment with test card
6. After payment success:
   - Navigate to Admin Dashboard → Intakes
   - Open the newly created intake
   - Verify "Service Selection & Pricing" card shows:
     - Website ✅, Email ✅ (required)
     - All other services ❌
     - Setup Total: $598.00
     - Monthly Total: $68.00/mo

### Expected Results
✅ No bundle discount applied (only 1 service)  
✅ Pricing snapshot stored in intake.rawPayload  
✅ Admin view displays correct selections  

---

## Scenario B: Website + Social (8 posts) + Google Business

### Steps
1. Navigate to `/onboarding`
2. Complete Steps 1-7
3. On Step 8:
   - Select "IT_HELPER" experience mode (technical language)
   - Check **Website** (Email auto-checks)
   - Select **Social Media: MEDIUM** (8 posts/month)
   - Check **Google Business**
4. On Step 9:
   - Verify setup subtotal: **$897.00** ($499 + $99 + $299 + $0)
   - Verify bundle discount: **-$149.50** (50% off Social setup)
   - Verify setup total: **$747.50**
   - Verify monthly total: **$216.00** ($49 + $19 + $129 + $19)
   - Verify banner shows "🎉 Bundle discount active!"
5. Complete Stripe checkout
6. Verify admin view shows:
   - Website ✅, Email ✅, Social Media ✅ (8 posts), Google Business ✅
   - Bundle discount line: -$149.50
   - Setup Total: $747.50

### Expected Results
✅ Bundle discount applied (2+ services with Social)  
✅ Social tier correctly labeled (8 posts)  
✅ IT_HELPER language used in service cards  

---

## Scenario C: Founder Promo ($300 Flat Override)

### Steps
1. Navigate to `/onboarding`
2. Complete Steps 1-7
3. On Step 7 (Promo Code):
   - Enter promo code: **BETA-FOUNDERS**
4. On Step 8:
   - Select all services:
     - Website ✅
     - Social Media: HIGH (12 posts) ✅
     - Enrichment Layer ✅
     - Google Business ✅
     - QuickBooks Sync ✅
5. On Step 9:
   - Verify setup total: **$300.00** (founder override)
   - Verify note: "Founder pricing: $300 flat setup for all services"
   - Verify monthly total still calculated normally (not overridden)
6. Complete Stripe checkout:
   - Verify single line item: "LaunchBase Setup (Beta Founder)" - $300.00
7. Verify admin view shows:
   - All services ✅
   - 🎉 Beta Founder Override: $300 flat
   - Setup Total: $300.00
   - Monthly Total: (normal calculation)

### Expected Results
✅ Founder override applied regardless of selections  
✅ Monthly pricing NOT overridden  
✅ Stripe metadata includes `is_founder: "true"`  
✅ Admin view shows founder badge  

---

## Scenario D: Enrichment Gating (Social Required)

### Steps
1. Navigate to `/onboarding`
2. Complete Steps 1-7
3. On Step 8:
   - Do NOT select Social Media
   - Try to check **Enrichment Layer**
4. Expected: Enrichment checkbox should be **disabled**
5. Now select **Social Media: LOW**
6. Expected: Enrichment checkbox should become **enabled**

### Expected Results
✅ Enrichment disabled when no Social tier selected  
✅ Enrichment enabled when Social tier selected  
✅ UI shows helper text explaining requirement  

---

## Scenario E: Email Lock (Website Required)

### Steps
1. Navigate to `/onboarding`
2. Complete Steps 1-7
3. On Step 8:
   - Check **Website**
4. Expected: **Email Service** should auto-check and become **disabled**
5. Try to uncheck Email Service
6. Expected: Cannot uncheck (locked)
7. Uncheck Website
8. Expected: Email Service should become **enabled** again

### Expected Results
✅ Email auto-selected when Website checked  
✅ Email locked (disabled) when Website checked  
✅ Email unlocked when Website unchecked  

---

## Validation Checklist

After running all scenarios, verify:

- [ ] Pricing snapshot stored in `intake.rawPayload.pricingSnapshot`
- [ ] Stripe metadata includes `pricing_version: "v1_2026_01_08"`
- [ ] Stripe metadata includes all service selections (flattened)
- [ ] Admin view card renders for all intakes with pricing snapshot
- [ ] Bundle discount only applies when 2+ services AND Social selected
- [ ] Founder promo overrides setup to $300 flat
- [ ] Monthly pricing never overridden by founder promo
- [ ] Experience mode (CUSTOMER/IT_HELPER) changes service card language
- [ ] All business rules enforced (Email lock, Enrichment gating)

---

## Debugging Tips

**If pricing doesn't match:**
- Check browser console for `computePricing()` output
- Verify `intake.rawPayload.pricingSnapshot` in database
- Check Stripe metadata on checkout session

**If admin view doesn't show:**
- Verify `intake.rawPayload.pricingSnapshot` exists
- Check TypeScript console for errors
- Ensure intake was created after this feature deployment

**If webhook fails:**
- Check webhook logs in Admin → Stripe Webhooks
- Verify `payment_type: "service_setup"` in metadata
- Ensure webhook endpoint is configured in Stripe dashboard
