# LaunchBase Universal Smoke Harness

## Purpose

A reusable testing primitive for **all LaunchBase systems** (websites, apps, integrations, OAuth, ads, email, etc.) that provides:

1. **Automated smoke tests** for every system
2. **Automatic FailurePacketV1 generation** on test failure
3. **Multi-model diagnosis swarm** (GPT-5.2 + Anthropic + Gemini + Grok) that produces patch plans
4. **Regression prevention** without slowing down shipping

## Core Principle

> "Given an input, assert invariant outputs and contract behavior."

---

## Benefits

1. **Catches regressions before production**
2. **Auto-generates diagnosis** (no manual debugging)
3. **Provides patch plans** (no guesswork)
4. **Scales to all systems** (reusable primitive)
5. **Fast feedback** (runs in CI)
