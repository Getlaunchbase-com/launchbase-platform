# AIML API Challengers for UI/UX Design Tournament (2026)

**Based on industry recommendations for UI/UX design workflows**

---

## 🎨 CATEGORY 1: Visual Design & UI Assets (Image Generation)

### ✅ GPT Image 1.5 (OpenAI)
- **AIML API Model ID**: TBD (need to verify exact ID)
- **Provider**: OpenAI
- **Type**: IMAGE generation
- **Use Case**: Sharp, production-ready visuals, high fidelity to complex prompts
- **Tournament Lane**: Artwork
- **Status**: ✅ Listed on AIML API
- **Priority**: HIGH

### ✅ Stable Diffusion (Various Versions)
- **AIML API Model ID**: TBD (multiple versions available)
- **Provider**: Stability AI / Open Source
- **Type**: IMAGE generation
- **Use Case**: UI components, icons, background textures
- **Tournament Lane**: Artwork
- **Status**: ✅ Available on AIML API
- **Priority**: MEDIUM

### ⚠️ Midjourney
- **AIML API Model ID**: TBD (via compatible integrations)
- **Provider**: Midjourney
- **Type**: IMAGE generation
- **Use Case**: High-fidelity mood boards, conceptual visual themes
- **Tournament Lane**: Artwork
- **Status**: ⚠️ Need to verify AIML API availability
- **Priority**: MEDIUM

---

## 🧠 CATEGORY 2: UX Research & Logical Structuring (Text LLMs)

### ✅ Claude 3.5 Sonnet (Anthropic)
- **AIML API Model ID**: `claude-3-5-sonnet-20240620`
- **Provider**: Anthropic
- **Context**: 200K tokens
- **Use Case**: Structure UX logic, create layouts from text descriptions
- **Tournament Lane**: Web, App, Marketing, Artwork
- **Status**: ✅ CONFIRMED AVAILABLE
- **Priority**: **HIGHEST** (Pilot #1 ready)

### ✅ Claude 4 / Claude 4.5 Opus/Sonnet (Anthropic)
- **AIML API Model ID**: TBD (saw Claude 4.5 Opus/Sonnet on AIML API)
- **Provider**: Anthropic
- **Use Case**: Advanced UX logic and layout structuring
- **Tournament Lane**: Web, App, Marketing, Artwork
- **Status**: ✅ Available on AIML API
- **Priority**: HIGH

### ✅ Gemini 2.0 / Gemini 3 (Google)
- **AIML API Model ID**: TBD (multiple versions: Gemini 3 Flash, Gemini 3 Pro Image)
- **Provider**: Google
- **Use Case**: Interface layouts, multimodal data (analyze design screenshots for feedback)
- **Tournament Lane**: Web, App, Marketing, Artwork
- **Status**: ✅ Available on AIML API
- **Priority**: HIGH
- **Note**: Gemini 2.5 Pro had 100% truncation rate in previous tests, avoid or increase maxTokens

### ✅ GPT-5.1 / GPT-5.2 (OpenAI)
- **AIML API Model ID**: TBD (saw GPT-5.1, GPT-5.2, GPT-5 Pro on AIML API)
- **Provider**: OpenAI
- **Use Case**: Detailed UX explanations, text-based wireframe descriptions
- **Tournament Lane**: Web, App, Marketing
- **Status**: ✅ Available on AIML API
- **Priority**: HIGH

---

## 💻 CATEGORY 3: UI Prototyping & Code Generation (Code LLMs)

### ✅ GPT-4o (OpenAI)
- **AIML API Model ID**: `openai/gpt-4o-2024-08-06` (current Control baseline)
- **Provider**: OpenAI
- **Use Case**: Generate React, Tailwind CSS, HTML/CSS code from UI descriptions
- **Tournament Lane**: Web, App (current baseline)
- **Status**: ✅ CONFIRMED (current Control)
- **Priority**: BASELINE (not a challenger)

### ✅ GPT-5 / GPT-5 Pro (OpenAI)
- **AIML API Model ID**: TBD (saw GPT-5 Pro on AIML API)
- **Provider**: OpenAI
- **Use Case**: Advanced code generation from wireframes/descriptions
- **Tournament Lane**: Web, App, Marketing
- **Status**: ✅ Available on AIML API
- **Priority**: HIGH

---

## 🎯 RECOMMENDED TOURNAMENT WORKFLOW

### Phase 1: Ideation (UX Research & Logical Structuring)
**Challengers**: Claude 3.5/4, Gemini 2.0/3, GPT-5.1
- **Lane**: Marketing (strategic messaging), Web/App (information architecture)
- **Role**: Systems Designer, Brand Designer

### Phase 2: Visual Concept (UI Assets)
**Challengers**: GPT Image 1.5, Stable Diffusion, Midjourney
- **Lane**: Artwork
- **Role**: Asset Generator

### Phase 3: Coding (UI Prototyping)
**Challengers**: GPT-5/GPT-5 Pro, Claude 4
- **Lane**: Web, App
- **Role**: Systems Designer (code generation)

---

## 📋 PILOT PRIORITY ORDER (Updated)

### **Pilot #1: Claude 3.5 Sonnet as Critic** ✅ READY NOW
- **Model ID**: `claude-3-5-sonnet-20240620`
- **Lanes**: Web + Marketing (2 reps each = 4 runs)
- **Stack**: 4o designers + Sonnet critic
- **Why First**: Confirmed available, tests critic reliability, exposes "confident liar" behavior

### **Pilot #2: GPT-5.1 or GPT-5 Pro (Full Stack)**
- **Model ID**: TBD (need to find exact ID)
- **Lanes**: Web + Marketing (2 reps each = 4 runs)
- **Stack**: GPT-5 for all 3 roles (systems, brand, critic)
- **Why Second**: OpenAI's latest, direct comparison to GPT-4o baseline

### **Pilot #3: Gemini 3 Flash (Full Stack)**
- **Model ID**: TBD (need to find exact ID)
- **Lanes**: Web + Marketing (2 reps each = 4 runs)
- **Stack**: Gemini 3 for all 3 roles
- **Why Third**: Multimodal capabilities, Google's latest

### **Pilot #4: Claude 4.5 Opus or Sonnet (Full Stack)**
- **Model ID**: TBD (need to find exact ID)
- **Lanes**: Web + Marketing (2 reps each = 4 runs)
- **Stack**: Claude 4.5 for all 3 roles
- **Why Fourth**: Anthropic's latest, advanced reasoning

### **Pilot #5: GPT Image 1.5 (Artwork Lane)**
- **Model ID**: TBD (need to find exact ID)
- **Lanes**: Artwork only (4 reps)
- **Stack**: GPT Image 1.5 for asset generation
- **Why Fifth**: Visual design quality test

---

## ⚠️ NEXT ACTIONS

1. ✅ **PROCEED**: Pilot #1 with Claude 3.5 Sonnet (model ID confirmed)
2. 🔍 **FIND MODEL IDs**: GPT-5.1, GPT-5 Pro, GPT Image 1.5, Gemini 3 Flash, Claude 4.5 Opus/Sonnet
3. 🔍 **VERIFY AVAILABILITY**: Midjourney, Stable Diffusion versions
4. 📝 **UPDATE BASELINE**: Add new challengers to baseline_truth_v1.2.json

---

## 🎯 IMMEDIATE RECOMMENDATION

**Proceed with Pilot #1: Claude 3.5 Sonnet as Critic**
- Model ID confirmed
- Web + Marketing lanes (catches claim-hallucination + implementation-hallucination)
- 4 runs total (2 reps each)
- Tests critic reliability before designer role
