# AIML API Model IDs for Challengers

## Available Models from aimlapi.com

### 1. Claude 3.5 Sonnet ✅
- **AIML API Model ID**: `claude-3-5-sonnet-20240620`
- **Provider**: Anthropic
- **Context Window**: 200K tokens
- **Input Price**: $3.15 per 1M tokens
- **Output Price**: $15.75 per 1M tokens
- **Type**: Chat (multimodal: language + vision)
- **Status**: Available
- **Notes**: Graduate-level reasoning, 2x speed of Claude 3 Opus, 64% HumanEval coding proficiency

### 2. Grok 4.1 Fast (xAI) - PENDING VERIFICATION
- **AIML API Model ID**: TBD (need to search)
- **Provider**: xAI
- **Status**: Pending verification on aimlapi.com

### 3. Groq Llama 3.1 70B - PENDING VERIFICATION
- **AIML API Model ID**: TBD (need to search)
- **Provider**: Groq (hardware-accelerated LPU)
- **Status**: Pending verification on aimlapi.com

### 4. Google Stitch - PENDING VERIFICATION
- **AIML API Model ID**: TBD (need to search)
- **Provider**: Google (Gemini 2.5 Pro backed)
- **Status**: Pending verification on aimlapi.com
- **Notes**: Text-to-UI generation, may inherit truncation risk from Gemini 2.5 Pro

### 5. Stable Diffusion 3 - PENDING VERIFICATION
- **AIML API Model ID**: TBD (need to search)
- **Provider**: Stability AI
- **Type**: Image generation
- **Status**: Pending verification on aimlapi.com

### 6. Flux 1.1 Pro - PENDING VERIFICATION
- **AIML API Model ID**: TBD (need to search)
- **Provider**: Black Forest Labs
- **Type**: Image generation
- **Status**: Pending verification on aimlapi.com

---

## Next Steps
1. Search for remaining models on aimlapi.com
2. Update baseline_truth_v1.2.json with confirmed AIML API model IDs
3. Configure pilot runner with correct model IDs for Pilot #1 (Claude 3.5 Sonnet as Critic)
