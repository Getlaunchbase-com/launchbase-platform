# Admin UI Findings - Status Transition Test

## Current State (Larry cabinets intake)
- Status: Deployed (shown in green badge at top)
- This intake is already deployed, so we can't test blocking invalid transitions on it

## Issue Found
- The intake shows "Deployed" status but the admin UI doesn't show status change buttons
- Only shows: "Hold Build" and "Request Clarification" buttons
- No dropdown or buttons to change status visible

## Need to Test
- Find an intake that is in "new" or "review" status to test the transition blocking
- Or create a new test intake to verify the flow

## Current Admin UI Elements
- "Hold Build" button
- "Request Clarification" button  
- "Open Preview in New Tab" button
- Internal Notes textarea
- No visible status change dropdown or state-machine buttons
