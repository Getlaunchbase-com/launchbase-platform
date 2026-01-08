# Admin UI State-Driven Stepper Verification

## What's Now Live

The Admin Intake Detail page now shows a proper state-driven UI with:

### Stepper Component
- Visual progress indicator: New → Review → Preview → Approved → Paid → Live
- Completed steps show green checkmarks
- Current step highlighted in orange (#FF6A00)
- Future steps dimmed

### System Rule Line
- "Customers always preview before paying. Payment is required before deployment."
- Reinforces the platform's trust philosophy

### State-Driven Action Buttons
- **new**: Shows "Start Review" button
- **review**: Shows "Send Preview to Customer" button
- **needs_info**: Shows "Send Preview to Customer" button
- **ready_for_review**: Shows disabled "Awaiting Customer Approval" with tooltip
- **approved**: Shows disabled "Awaiting Payment" with tooltip
- **paid**: Shows "Deploy Now" button
- **deployed**: Shows "Site is Live" badge

### Artifact Links
- "Open Preview" button when previewToken exists
- "Open Live Site" button when deployed

### Disabled State Helper Text
- Yellow warning panel explaining why certain actions are disabled
- "Customer must approve the preview before you can proceed."
- "Payment is required before deployment can start."

## Current Status (Larry cabinets)
- Status: approved (Customer Approved)
- Stepper shows: New ✓ → Review ✓ → Preview ✓ → Approved (current) → Paid → Live
- Action: "Awaiting Payment" (disabled)
- Helper text: "Payment is required before deployment can start. Customer will complete checkout via Stripe."

## Tests
- All 164 tests passing
- TypeScript compilation: 0 errors
