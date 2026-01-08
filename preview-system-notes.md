# LaunchBase Preview System - Implementation Notes

## What's Working

The site preview rendering system is now fully functional:

1. **Admin Dashboard**: When viewing an intake, admins can click "Open Preview in New Tab" to see the generated website
2. **Customer Preview**: When customers access their preview link, they see the generated website in an iframe
3. **Build Plan Integration**: The preview uses data from the build plan (vertical, tone, CTA, pages, hero copy)

## Preview Features

- **Header**: Business name, navigation links, CTA button
- **Hero Section**: Dynamic headline and subheadline based on vertical and business info
- **Trust Bar**: Licensed & Insured, Free Estimates, Satisfaction Guaranteed, Service Area
- **Services Section**: 4 service cards with icons
- **About Section**: Business description or auto-generated copy
- **CTA Section**: Orange call-to-action with "Ready to Get Started?"
- **Footer**: Contact info, service area, hours, copyright

## Color Schemes by Vertical

- **Trades**: Orange (#FF6A00) primary, Dark blue (#1a1a2e) secondary
- **Appointments**: Purple (#6366F1) primary, Dark purple (#1e1b4b) secondary  
- **Professional**: Blue (#0EA5E9) primary, Dark blue (#0c4a6e) secondary

## Files

- `/client/src/lib/previewGenerator.ts` - Client-side preview HTML generator
- `/server/previewTemplates.ts` - Server-side preview templates (for API responses)

## Preview Banner

All previews include a fixed banner at the bottom:
"🚀 This is a preview of your website. Powered by LaunchBase."
