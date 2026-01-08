# LaunchBase Suite - Complete Export Package

**Created:** December 21, 2024  
**Source:** Vince's Snow Plow (Beta Customer #1)  
**Purpose:** Transfer complete LaunchBase architecture to platform

---

## 🎯 Core Philosophy

### **The Value Proposition**
> "Workflows that give you back your life."

LaunchBase is not features. It's **relief from obligation**.

**Test for every feature:**
> "Does this remove a recurring mental burden from the business owner?"

If yes → ship  
If no → cut or upsell later

---

## 🧩 Product Architecture

### **LaunchBase Core (Always Included)**
- Website build + hosting
- Approval workflow
- Basic posting capability
- Safety rules (weather gating, tone, compliance)
- Admin dashboard

### **LaunchBase Suite (À La Carte Modules)**

#### **📱 Social Media Intelligence**
**Base:** $129/mo (Medium depth)

**Includes:**
- Weather Intelligence (always on)
- Time & season awareness
- Approval workflow
- Facebook posting

**Add-On Layers (À La Carte):**
- 🏈 Sports & Events - $29/mo
- 🎓 Community & Schools - $39/mo
- 📈 Local Trends - $49/mo

**Message Tuning Modes:**
1. **Auto** (Default) - "Set it and forget it"
2. **Guided** - "We advise, you decide"
3. **Custom** - "Full control, with guardrails"

**Depth Levels:**
- **Low** ($79/mo) - Conservative, fewer posts
- **Medium** ($129/mo) - Balanced, 2-3 posts/week
- **High** ($199-249/mo) - Aggressive relevance

#### **📊 QuickBooks Sync**
**Price:** $249 setup + $79/mo

**Features:**
- Customer creation
- Invoice/estimate sync
- Payment status awareness

#### **📈 Google Business & Ads Assistant**
**Price:** TBD + Try Free 30 days

**Features:**
- Weather-triggered ad suggestions
- Event-based suggestions
- Copy generation

---

## 🎨 Design Principles

### **Visual Direction**
✅ **Like:** Stripe, Notion, Linear  
❌ **NOT:** HubSpot, Zapier, marketing dashboards

### **UI Principles**
- **Calm**, not busy
- **Opinionated**, not neutral
- **Explain-first**, not toggle-first
- **Changeable anytime**, zero guilt

### **North Star**
> "Oh wow... this is already handled."

NOT: "I should tweak this..."

---

## 💬 Copy Guidelines

### **Use These Lines:**
- "You don't need to think about this anymore"
- "LaunchBase handles it"
- "Based on businesses like yours..."
- "Change anytime"
- "Nothing posts without your approval (unless you choose Auto)"

### **Never Say:**
- "AI"
- "Algorithm"
- "Automation engine"
- "Model"

---

## 🏗️ Technical Architecture

### **Database Schema**

```sql
CREATE TABLE intelligence_layers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  userId INT NOT NULL,
  depthLevel ENUM('low', 'medium', 'high') DEFAULT 'low',
  weatherEnabled INT DEFAULT 1, -- Always on
  eventsEnabled INT DEFAULT 0,
  sportsEnabled INT DEFAULT 0,
  communityEnabled INT DEFAULT 0,
  trendsEnabled INT DEFAULT 0,
  monthlyPrice INT NOT NULL, -- in cents
  setupFee INT NOT NULL, -- in cents
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

### **Rules Engine**

```
Weather Check (always first)
   ↓
Industry Profile
   ↓
Enabled Context Layers
   ↓
Confidence Thresholds
   ↓
Final Message (or silence)
```

**Key Rules:**
- Weather ALWAYS evaluated first
- Safety gates cannot be bypassed
- Layers add context, never override safety
- **Silence is valid output**

---

## 📁 Code Files to Transfer

### **Backend Services**

1. **`server/services/weather-intelligence.ts`**
   - NWS API integration
   - Multi-ZIP monitoring
   - Hourly forecast parsing
   - Graph URL generation

2. **`server/services/weather-analyzer.ts`**
   - AI analysis of forecast data
   - Post type classification (ACTIVE_STORM, MONITORING, ALL_CLEAR, etc.)
   - Urgency detection
   - Timing recommendations

3. **`server/services/context-builder.ts`**
   - Temporal context extraction
   - Day of week / time of day awareness
   - Holiday detection
   - Season awareness
   - Sports schedule knowledge (AI-based)

4. **`server/services/local-intelligence.ts`**
   - Google Trends integration (geo-filtered)
   - Local news RSS parsing
   - Confidence scoring
   - Relevance filtering

5. **`server/services/facebook-poster.ts`**
   - Meta Graph API integration
   - Post publishing
   - Error handling
   - Connection testing

6. **`server/services/weather-post-orchestrator.ts`**
   - Combines intelligence + analysis + posting
   - Smart cadence logic
   - Post generation

### **Backend Routers**

7. **`server/routers/intelligence-layers.ts`**
   - Get/save layer configuration
   - Calculate pricing
   - Industry recommendations
   - tRPC endpoints

8. **`server/routers/weather.ts`**
   - Generate weather posts
   - Approval flow
   - Post to Facebook
   - Usage tracking

### **Frontend Components**

9. **`client/src/pages/ExpandLaunchBase.tsx`**
   - Product control plane UI
   - Module cards
   - Layer management modal
   - Message Tuning selector
   - Depth slider
   - Pricing calculator

### **Database Schema**

10. **`drizzle/schema.ts`**
    - intelligence_layers table
    - post_approvals table
    - post_usage table

### **Documentation**

11. **`docs/weather-intelligence-system.md`**
12. **`docs/local-context-intelligence.md`**

---

## 🎯 Vince's Configuration (Beta Customer)

### **Active Modules:**
- Social Media Intelligence (Medium depth)
- QuickBooks Sync

### **Active Layers:**
- ✅ Weather Intelligence (always on)
- ✅ Sports & Events (Bears games)
- ✅ Temporal Context
- ❌ Community & Schools (not needed)
- ❌ Local Trends (not needed)

### **Settings:**
- Message Tuning: **Auto**
- Depth: **Medium**
- Expected: 2-3 posts/week
- Monthly: $129 + $79 = $208

### **Service Area:**
- Elk Grove Village, IL (60007)
- Des Plaines, IL (60016, 60018)
- Mount Prospect, IL (60056)
- Arlington Heights, IL (60004, 60005)
- Niles, IL (60714)

### **Example Post Generated:**
> "🏈🐻❄️ Bear Down! We clear the snow so you can catch the game. Go Chicago Bears!"

**Context Used:**
- Weather: Clear conditions
- Sports: Bears game day (Sunday)
- Time: Pre-game timing
- Season: Winter
- Business: Snow removal

---

## 💰 Pricing Model

### **Setup Fees (One-Time)**
- Weather Intelligence Core: **Included**
- Each additional layer: **$99-$199**

### **Monthly Subscription (Depth-Based)**
- **Low** (Conservative): **$79/mo**
- **Medium** (Balanced): **$129/mo**
- **High** (Advanced): **$199-$249/mo**

### **À La Carte Layer Pricing**
- Sports & Events: **$29/mo**
- Community & Schools: **$39/mo**
- Local Trends: **$49/mo**

### **Bundles**
- **Local Awareness Pack:** $99/mo (Sports + Community + Events, save $28)
- **Complete Intelligence:** $129/mo (All layers, save $57)

---

## 🚀 Implementation Priority

### **Phase 1: Core Infrastructure**
1. Database schema for intelligence layers
2. Weather Intelligence service (NWS integration)
3. Weather Analyzer service (AI classification)
4. Basic posting capability

### **Phase 2: Context Layers**
1. Context Builder (temporal awareness)
2. Sports & Events layer
3. Community & Schools layer
4. Local Trends layer

### **Phase 3: Customer Experience**
1. ExpandLaunchBase UI
2. Layer selection modal
3. Pricing calculator
4. Approval workflow

### **Phase 4: Integrations**
1. Facebook posting
2. QuickBooks sync
3. Google Ads assistant

---

## 📋 Transfer Checklist

- [ ] Copy all service files to LaunchBase
- [ ] Update database schema
- [ ] Configure NWS API endpoints
- [ ] Set up Facebook app credentials
- [ ] Create Stripe products for tiers
- [ ] Build admin dashboard for module management
- [ ] Test with Vince's configuration
- [ ] Document API endpoints

---

**This is platform economics, not agency economics. Ship it.** 🚀
