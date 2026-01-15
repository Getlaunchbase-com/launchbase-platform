# Asset Model Lane Rules

**Version:** 1.0  
**Last Updated:** January 15, 2026

## Overview

Asset models (image generators, UI builders) require separate scoring rubrics from text LLMs to avoid false "liar" labels. This document defines lane-specific rules for evaluating asset models in the tournament infrastructure.

## Model Classes

### Text LLMs
- **Examples:** GPT-4o, Claude Opus, Claude 3.5 Sonnet, Grok, Groq
- **Artifact Kind:** `json`
- **Eligible Lanes:** web, app, marketing
- **Scoring Rubric:** TruthPenalty v1.0 (unverifiable/invented/vague/strain)
- **Schema:** CraftOutputSchema, CriticOutputSchema

### Image Generators
- **Examples:** Stable Diffusion 3, Flux 1.1 Pro
- **Artifact Kind:** `image`
- **Eligible Lanes:** artwork ONLY
- **Scoring Rubric:** Asset Quality Score (composition/clarity/brand_alignment)
- **Schema:** AssetOutputSchema (NOT CraftOutputSchema)

### UI Builders
- **Examples:** Google Stitch (Gemini 2.5 Pro)
- **Artifact Kind:** `mixed` (code + image)
- **Eligible Lanes:** web, app
- **Scoring Rubric:** Hybrid (code truthPenalty + visual quality)
- **Schema:** UIBuilderOutputSchema

## Lane Rules

### Artwork Lane

**Asset models (SD3, Flux) in artwork lane:**

1. **Do NOT judge by LLM designer schema**
   - No CraftOutputSchema validation
   - No anchor count requirements
   - No truthPenalty for "vagueness" (images are inherently visual, not textual)

2. **Use Asset Quality Score instead:**
   - **Composition** (0-40 points): Layout, balance, visual hierarchy
   - **Clarity** (0-30 points): Resolution, sharpness, color accuracy
   - **Brand Alignment** (0-30 points): Matches brand guidelines, style consistency
   - **Total:** 0-100 points

3. **Artifact validation:**
   - Must produce valid image file (PNG/JPEG/WebP)
   - Minimum resolution: 1024×1024
   - Maximum file size: 10MB
   - Color space: sRGB

4. **No truthPenalty applied:**
   - Image generators cannot "lie" in the same way LLMs can
   - Quality issues are captured in Asset Quality Score, not truthPenalty

### Web/App Lanes

**UI builders (Stitch) in web/app lanes:**

1. **Hybrid scoring:**
   - **Code component** (60%): Judged by CraftOutputSchema + truthPenalty
   - **Visual component** (40%): Judged by Asset Quality Score

2. **Artifact validation:**
   - Must produce valid code artifact (HTML/CSS/JS)
   - Must produce visual preview (PNG/JPEG)
   - Code must pass schema validation
   - Visual must meet minimum quality threshold (≥70/100)

3. **TruthPenalty applies to code only:**
   - Unverifiable claims in code comments/documentation
   - Invented features in code (non-existent APIs, libraries)
   - Vague implementation (no concrete specs)

4. **Asset Quality Score applies to visual only:**
   - Composition, clarity, brand alignment
   - Does NOT penalize for "vagueness" (visual is inherently less textual)

## Schema Definitions

### AssetOutputSchema (Image Generators)

```typescript
{
  assetType: "image",
  format: "png" | "jpeg" | "webp",
  resolution: { width: number, height: number },
  filePath: string,
  metadata: {
    prompt: string,
    model: string,
    seed?: number,
    steps?: number,
  },
}
```

### UIBuilderOutputSchema (UI Builders)

```typescript
{
  code: {
    html: string,
    css: string,
    js?: string,
    changes: Change[],  // CraftOutputSchema format
  },
  visual: {
    previewPath: string,
    resolution: { width: number, height: number },
  },
}
```

## Challenger Catalog Updates

Asset models in `challengerCatalog.challengers` must specify:

```json
{
  "id": "stability-ai/sd3",
  "artifactKind": "image",
  "laneEligibility": ["artwork"],
  "scoringRubric": "asset_quality",
  "notes": "Image generation model, artwork lane only. Do NOT judge by LLM designer schema."
}
```

UI builders must specify:

```json
{
  "id": "google/stitch",
  "artifactKind": "mixed",
  "laneEligibility": ["web", "app"],
  "scoringRubric": "hybrid",
  "notes": "UI builder with code + visual output. Hybrid scoring (60% code truthPenalty, 40% visual quality)."
}
```

## Implementation Checklist

- [ ] Create `AssetQualityScorer.ts` for image quality evaluation
- [ ] Create `AssetOutputSchema` Zod schema
- [ ] Create `UIBuilderOutputSchema` Zod schema
- [ ] Update `aimlSpecialist.ts` to route asset models to correct schema
- [ ] Update `truthPenalty.ts` to skip asset models (or apply hybrid scoring for UI builders)
- [ ] Update tournament runners to handle mixed artifact types
- [ ] Add asset model validation to preflight checks

## Notes

- **Why separate rubrics?** Image generators produce visual artifacts, not text. Judging them by text-based truthPenalty would produce false "liar" labels for inherently visual outputs.
- **Why hybrid scoring for UI builders?** UI builders produce both code and visuals. Code should be judged by truthPenalty (can contain unverifiable claims), but visuals should be judged by quality (composition/clarity).
- **Why artwork lane only for image generators?** Web/app lanes require implementable code, not just visuals. Image generators cannot produce code, so they're restricted to artwork lane.

## Future Enhancements

1. **Multi-modal LLMs (GPT-4V, Claude 3.5 Vision):** May compete in artwork lane with hybrid scoring (text truthPenalty + visual quality)
2. **Video generators (Sora, Runway):** Require separate rubric (temporal consistency, motion quality, audio sync)
3. **3D asset generators (Point-E, Shap-E):** Require separate rubric (geometry quality, texture resolution, polygon count)
