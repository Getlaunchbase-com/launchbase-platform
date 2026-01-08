# LaunchBase Template Expansion Roadmap

> How to add new templates and expand vertical coverage.

---

## Current Templates

| Template ID | Vertical | Status |
|-------------|----------|--------|
| trades_v1 | Trades (plumbing, HVAC, electrical) | Active |
| appointments_v1 | Appointments (salons, clinics, fitness) | Active |
| professional_v1 | Professional (lawyers, accountants, consultants) | Active |

---

## Template Structure

Each template consists of:

```
templates/
  {template_id}/
    index.html          # Main template file
    styles.css          # Template-specific styles
    config.json         # Template configuration
    preview.png         # Preview image for admin
    README.md           # Template documentation
```

### config.json Schema

```json
{
  "id": "trades_v1",
  "name": "Trades Template v1",
  "vertical": "trades",
  "version": "1.0.0",
  "pages": ["home", "services", "about", "contact", "emergency"],
  "features": {
    "emergencyCTA": true,
    "serviceAreaMap": true,
    "reviewsWidget": false
  },
  "variables": {
    "primaryColor": "#FF6A00",
    "heroHeadline": "{{businessName}} — {{tagline}}",
    "ctaText": "Call Now"
  }
}
```

---

## Adding a New Template

### Step 1: Define the Vertical

Before building, answer:
- What type of businesses will use this?
- What's their primary CTA? (call, book, form)
- What pages do they need?
- What's the typical tone? (professional, friendly, urgent)

### Step 2: Create the Template Files

1. Copy an existing template as a starting point
2. Modify the HTML structure
3. Update the config.json
4. Create a preview image

### Step 3: Register the Template

Add the template to the build system:

```typescript
// server/templates.ts
export const TEMPLATES = {
  trades_v1: { ... },
  appointments_v1: { ... },
  professional_v1: { ... },
  // Add new template here
  restaurant_v1: {
    id: "restaurant_v1",
    vertical: "restaurant",
    pages: ["home", "menu", "about", "contact", "reservations"],
    defaultCTA: "Reserve a Table",
  },
};
```

### Step 4: Update the Intake Flow

If the new template requires different intake questions:

1. Add the vertical option to the onboarding flow
2. Update the AI inference logic
3. Test the full flow

### Step 5: Test & Deploy

1. Create a test intake for the new vertical
2. Generate a build plan
3. Deploy a test site
4. Review on desktop and mobile
5. Fix any issues
6. Mark as active

---

## Planned Templates

### Phase 2 (Q1 2025)

| Template | Vertical | Priority |
|----------|----------|----------|
| restaurant_v1 | Restaurants | High |
| realestate_v1 | Real Estate Agents | High |
| fitness_v1 | Gyms & Trainers | Medium |

### Phase 3 (Q2 2025)

| Template | Vertical | Priority |
|----------|----------|----------|
| ecommerce_v1 | Simple E-commerce | High |
| nonprofit_v1 | Nonprofits | Medium |
| creative_v1 | Photographers, Artists | Medium |

---

## Template Quality Checklist

Before marking a template as active:

- [ ] Mobile responsive
- [ ] Fast loading (< 3s)
- [ ] Accessible (WCAG 2.1 AA)
- [ ] SEO-friendly (meta tags, structured data)
- [ ] Contact form works
- [ ] Phone number is clickable
- [ ] No placeholder text
- [ ] Images are optimized
- [ ] Cross-browser tested (Chrome, Safari, Firefox)

---

## Template Versioning

When updating an existing template:

1. **Minor changes** (copy, colors) — Update in place
2. **Major changes** (layout, structure) — Create new version (e.g., trades_v2)
3. **Breaking changes** — Migrate existing sites or maintain both versions

### Version Naming

- `{vertical}_v{major}` — e.g., trades_v1, trades_v2
- Major version = significant layout/structure changes
- Minor updates don't change version number

---

## Performance Targets

| Metric | Target |
|--------|--------|
| First Contentful Paint | < 1.5s |
| Largest Contentful Paint | < 2.5s |
| Cumulative Layout Shift | < 0.1 |
| Total Page Size | < 1MB |

---

## Resources

- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
- [Google PageSpeed Insights](https://pagespeed.web.dev/)
- [WAVE Accessibility Tool](https://wave.webaim.org/)

---

*Last updated: December 2024*
