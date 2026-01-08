# Cabinet Maker Beta Smoke Test Checklist

## Overview

This checklist validates that the end-to-end LaunchBase flow works correctly for the cabinet maker beta customer. Run this test after Phase 1 hosting integration is complete.

## Pre-Test Setup

- [ ] Cabinet maker contact info ready (name, email, phone, business name)
- [ ] Carpenter vertical selected in `/apply` flow
- [ ] Carpenter sub-category selected (e.g., "Custom Cabinetry")
- [ ] Admin account logged in and ready
- [ ] Stripe test mode active
- [ ] Deployment worker running (or cron configured)
- [ ] Browser DevTools open (for console errors)

## Test Flow

### Phase 1: Application Submission

**Step 1.1: Start Application**
- [ ] Navigate to https://getlaunchbase.com/apply
- [ ] Verify page loads without errors
- [ ] Verify "Get started" button is visible

**Step 1.2: Complete Onboarding**
- [ ] Fill in all 8 steps:
  - [ ] Business name (e.g., "Larry's Custom Cabinets")
  - [ ] Service area (e.g., "Denver, CO")
  - [ ] Primary CTA (e.g., "Get a Quote")
  - [ ] Vertical (Trades)
  - [ ] Industry (Carpenter → Custom Cabinetry)
  - [ ] Language (English)
  - [ ] Contact info (name, email, phone)
  - [ ] Confirmation review
- [ ] Verify progress bar shows 8/8
- [ ] Click "Submit Application"
- [ ] Verify success page appears with confirmation message
- [ ] Verify confirmation email sent (check inbox)

### Phase 2: Admin Approval

**Step 2.1: View in Admin Dashboard**
- [ ] Log in to admin at https://getlaunchbase.com/admin
- [ ] Navigate to "Intakes" or "Suite Applications"
- [ ] Verify new application appears in list
- [ ] Verify application shows correct business name, vertical, language
- [ ] Click on application to open detail view

**Step 2.2: Review Build Plan**
- [ ] Verify build plan was auto-generated
- [ ] Verify build plan content matches intake:
  - [ ] Business name correct
  - [ ] Service area correct
  - [ ] Primary CTA correct
  - [ ] Industry/vertical correct
- [ ] Verify confidence score is displayed
- [ ] Verify preview link is available

**Step 2.3: Approve Application**
- [ ] Click "Approve & Create Intake" button
- [ ] Verify modal opens with pre-filled business name
- [ ] Verify "Auto-generate build plan" is checked
- [ ] Click "Approve" in modal
- [ ] Verify success toast appears
- [ ] Verify application status changes to "Approved"
- [ ] Verify intake was created (check Intake ID)

### Phase 3: Customer Preview

**Step 3.1: Access Preview Link**
- [ ] Check email for "Your site preview is ready" message
- [ ] Click preview link in email
- [ ] Verify preview page loads without errors
- [ ] Verify preview shows correct business name
- [ ] Verify preview shows correct services/CTA
- [ ] Verify preview is mobile-responsive (test on phone)

**Step 3.2: Review & Approve**
- [ ] Review site preview on desktop
- [ ] Review site preview on mobile
- [ ] Verify no mixed-content warnings (browser console)
- [ ] Verify no blocked assets (browser console)
- [ ] Verify "Approve & Pay" button is visible
- [ ] Click "Approve & Pay" button

### Phase 4: Payment

**Step 4.1: Stripe Checkout**
- [ ] Verify Stripe checkout page loads
- [ ] Verify amount is correct ($499 setup fee)
- [ ] Verify business name is displayed
- [ ] Fill in test card: `4242 4242 4242 4242`
- [ ] Fill in expiry: `12/25` (any future date)
- [ ] Fill in CVC: `123` (any 3 digits)
- [ ] Fill in ZIP: `12345` (any ZIP)
- [ ] Click "Pay" button

**Step 4.2: Payment Success**
- [ ] Verify payment success page appears
- [ ] Verify "Payment Successful" message
- [ ] Verify deployment status shows "Queued" or "Provisioning Link"
- [ ] Verify email sent with deployment status
- [ ] Verify "Powered by LaunchBase" footer link works

### Phase 5: Deployment

**Step 5.1: Trigger Deployment**
- [ ] Navigate to `/admin/deployments`
- [ ] Verify deployment appears in queue
- [ ] Click "Run Next Deployment" button
- [ ] Verify deployment status changes to "Running"

**Step 5.2: Monitor Deployment**
- [ ] Watch deployment progress
- [ ] Verify status changes from "Running" to "Success"
- [ ] Verify live URL is generated (format: `site-{slug}-{id}.launchbase-h86jcadp.manus.space`)
- [ ] Verify "Live ✅" status appears
- [ ] Verify deployment timestamp is recent

**Step 5.3: Verify Live Site**
- [ ] Click "View Site" or "Open Live Site" button
- [ ] Verify URL resolves (no NXDOMAIN error)
- [ ] Verify page loads without errors
- [ ] Verify content matches preview:
  - [ ] Business name correct
  - [ ] Services/CTA correct
  - [ ] Colors/branding correct
- [ ] Verify page is mobile-responsive
- [ ] Verify no mixed-content warnings
- [ ] Verify no blocked assets
- [ ] Test CTA button (should work or show placeholder)

**Step 5.4: Verify Email**
- [ ] Check email for "Your website is live" message
- [ ] Verify email includes live URL
- [ ] Verify email includes next steps
- [ ] Click link in email to verify it works

## Post-Test Validation

### Performance

- [ ] Page load time < 3 seconds (desktop)
- [ ] Page load time < 5 seconds (mobile)
- [ ] No console errors in browser DevTools
- [ ] No console warnings (except expected ones)

### Content Accuracy

- [ ] Business name matches intake
- [ ] Service area matches intake
- [ ] Primary CTA matches intake
- [ ] Industry/vertical correct
- [ ] Language correct (if multi-language)

### Functionality

- [ ] All links work (internal and external)
- [ ] CTA button is clickable
- [ ] Footer "Powered by LaunchBase" link works
- [ ] Mobile menu works (if applicable)
- [ ] Forms submit successfully (if applicable)

### Security

- [ ] HTTPS enabled (lock icon in browser)
- [ ] No mixed-content warnings
- [ ] No security warnings
- [ ] No third-party tracking issues

## Failure Scenarios

### If Preview Doesn't Load

- [ ] Check browser console for errors
- [ ] Verify preview token is valid
- [ ] Check admin logs for build plan generation errors
- [ ] Verify database connection is working

### If Deployment Fails

- [ ] Check `/admin/deployments` for error message
- [ ] Check server logs for worker errors
- [ ] Verify WORKER_TOKEN is set correctly
- [ ] Verify Manus infrastructure is accessible
- [ ] Retry deployment manually

### If Live URL Doesn't Resolve

- [ ] Wait 30-60 seconds (DNS propagation)
- [ ] Try incognito/private browsing (clear cache)
- [ ] Check if URL format is correct
- [ ] Verify Manus hosting is operational
- [ ] Check server logs for reachability check failures

### If Content Doesn't Match

- [ ] Verify build plan was generated correctly
- [ ] Check if preview template matches live template
- [ ] Verify intake data was saved correctly
- [ ] Check for template rendering errors in logs

## Success Criteria

✅ **All items checked** — Test passed  
✅ **Live URL resolves and displays correct content** — Test passed  
✅ **No console errors or warnings** — Test passed  
✅ **Mobile and desktop both work** — Test passed  
✅ **All emails received** — Test passed  

## Sign-Off

**Tester Name:** ___________________  
**Date:** ___________________  
**Result:** ☐ PASS ☐ FAIL  
**Notes:** ___________________

---

## Next Steps (If Test Passes)

1. Celebrate! 🎉
2. Prepare cabinet maker for real launch
3. Set up external cron for deployment automation
4. Configure Facebook integration for Vince's Snow Plow
5. Plan Phase 2 custom domain migration

## Related Documentation

- HOSTING_INTEGRATION.md — Phase 1 hosting details
- CRON_SETUP.md — Deployment worker automation
- FACEBOOK_INTEGRATION.md — Facebook posting setup
