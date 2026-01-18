# AIML API Challenger Availability Status

**Cross-referenced with aimlapi.com on 2026-01-15**

## ✅ AVAILABLE Models

### 1. Claude 3.5 Sonnet
- **AIML API Model ID**: `claude-3-5-sonnet-20240620`
- **Provider**: Anthropic
- **Context**: 200K tokens
- **Pricing**: $3.15 input / $15.75 output per 1M tokens
- **Status**: ✅ Available
- **URL**: https://aimlapi.com/models/claude-3-5-sonnet
- **Notes**: Graduate-level reasoning, 2x speed of Claude 3 Opus, 64% HumanEval

### 2. Grok 4 (xAI)
- **AIML API Model ID**: Unknown (page shows Grok 4 exists but no model ID visible)
- **Provider**: xAI
- **Context**: 256K tokens
- **Status**: ✅ Available (but model ID not confirmed)
- **URL**: https://aimlapi.com/grok-4
- **Notes**: 10x more compute than Grok 3, 76.9% AIME 2025, 15.9% ARC-AGI-2, native tool use

### 3. FLUX.2 Max (Black Forest Labs)
- **AIML API Model ID**: Likely `flux-2-max` or similar
- **Provider**: Black Forest Labs
- **Type**: IMAGE generation
- **Status**: ✅ Available (seen in model list)
- **Notes**: FLUX.2 Max and FLUX.2 Max Edit both available

## ❌ NOT FOUND on aimlapi.com

### 4. Groq Llama 3.1 70B
- **Provider**: Groq (hardware-accelerated LPU)
- **Status**: ❌ Not found on aimlapi.com
- **Notes**: Groq is an inference provider, not a model provider. AIML API may have Llama 3.1 70B from other providers (Meta, Together, etc.)

### 5. Google Stitch
- **Provider**: Google
- **Status**: ❌ Not found on aimlapi.com
- **Notes**: Stitch is currently in Beta (per UX Design Institute article). May not be publicly available via API yet.

### 6. Stable Diffusion 3
- **Provider**: Stability AI
- **Type**: IMAGE generation
- **Status**: ❌ Not found on aimlapi.com
- **Notes**: AIML API has other Stability AI models but SD3 specifically not listed

## 🔍 RECOMMENDED PILOT ORDER (Based on Availability)

### Pilot #1: Claude 3.5 Sonnet as Critic ✅ READY
- **Lane**: Web + Marketing (2 reps each = 4 runs)
- **Stack**: 
  - Systems designer: gpt-4o-2024-08-06
  - Brand designer: gpt-4o-2024-08-06
  - Critic: **claude-3-5-sonnet-20240620** ← CHALLENGER
- **Model ID**: `claude-3-5-sonnet-20240620`
- **Status**: ✅ Can proceed immediately

### Pilot #2: Grok 4 (if model ID confirmed)
- **Lane**: Web + Marketing
- **Stack**: Full Grok 4 stack (all 3 roles)
- **Model ID**: TBD (need to find exact ID)
- **Status**: ⚠️ Need to confirm model ID first

### Pilot #3: FLUX.2 Max
- **Lane**: Artwork only
- **Type**: Image generation
- **Model ID**: TBD (need to find exact ID)
- **Status**: ⚠️ Need to confirm model ID first

## ⚠️ BLOCKED Challengers

1. **Groq Llama 3.1 70B** - Not available on AIML API (Groq is inference provider, not model)
2. **Google Stitch** - Still in Beta, not publicly available
3. **Stable Diffusion 3** - Not listed on AIML API

## 📋 NEXT ACTIONS

1. ✅ **READY**: Run Pilot #1 with Claude 3.5 Sonnet as Critic
2. ⚠️ **PENDING**: Find exact model ID for Grok 4 (search AIML API docs or model registry)
3. ⚠️ **PENDING**: Find exact model ID for FLUX.2 Max
4. ❌ **SKIP**: Groq, Stitch, SD3 (not available on AIML API)

## 🎯 IMMEDIATE RECOMMENDATION

**Proceed with Pilot #1: Claude 3.5 Sonnet as Critic**
- Model ID confirmed: `claude-3-5-sonnet-20240620`
- Lanes: Web + Marketing
- Reps: 2 each (4 total runs)
- Stack: 4o designers + Sonnet critic
- Expected to catch "confident liar" behavior in Marketing (claim-hallucination) and Web (implementation-hallucination)
