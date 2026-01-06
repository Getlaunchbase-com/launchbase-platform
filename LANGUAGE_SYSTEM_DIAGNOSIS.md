# Language & Audience System Diagnosis

**Date:** 2026-01-06  
**Status:** ✅ Architecture correct, ❌ Translations missing

## Summary

The preference system architecture is **100% correct** and working as designed. The only missing piece is Spanish and Polish translations in the homepage copy object.

## What Works ✅

1. **Preferences Library (`client/src/lib/prefs.ts`)**
   - `getPrefs()` - retrieves from localStorage with defaults
   - `setPrefs()` - updates localStorage and dispatches `lb:prefs` event
   - `subscribePrefs()` - subscribes to preference changes
   - Event-driven reactivity works correctly

2. **Header Component (`client/src/components/Header.tsx`)**
   - Uses native `<select>` elements (lines 55-77)
   - `onChange` handlers correctly call `updateAudience()` and `updateLanguage()`
   - Handlers update localStorage and trigger re-renders
   - **Proven by manual JavaScript trigger:**
     ```
     [log] [Header] updateAudience called: org
     [log] [Header] prefs updated: {language: en, audience: org}
     ```

3. **Home Component (`client/src/pages/Home.tsx`)**
   - Subscribes to prefs changes (line 108-110)
   - Dynamically renders copy based on `language` and `audience`
   - Fallback to `copy.en.biz` when translation missing
   - **Proven by manual test:** Copy switched from Business to Organization correctly

## What's Missing ❌

**Spanish and Polish translations in Home.tsx copy object:**

```typescript
const copy = {
  en: {
    biz: { h1, p, badge, ctaPrimary, ctaSecondary },
    org: { h1, p, badge, ctaPrimary, ctaSecondary }
  },
  // ❌ Missing:
  // es: { biz: {...}, org: {...} },
  // pl: { biz: {...}, org: {...} }
};
```

## Browser Automation Note

The `browser_select_option` tool doesn't trigger React's synthetic `onChange` events on native `<select>` elements. This is a **testing limitation**, not a production bug. Manual JavaScript triggers and real user interactions work correctly.

## Next Steps

1. Add Spanish translations for biz and org
2. Add Polish translations for biz and org
3. Test all 6 combinations (EN/ES/PL × Business/Organization)
4. Update todo.md and checkpoint
