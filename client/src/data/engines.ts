// client/src/data/engines.ts
export type EngineId = "inbox" | "phone" | "social" | "ads" | "books";

export type Engine = {
  id: EngineId;
  name: string;
  doesForYou: string;
  setupFeeUsd: number;
  careFeeMonthlyUsd: number;
  oftenUsedWith?: string[];
  requires: string[];
};

export const ENGINES: Engine[] = [
  {
    id: "inbox",
    name: "Inbox Engine",
    doesForYou: "Business email, routing, auto-replies, lead follow-up.",
    setupFeeUsd: 99,
    careFeeMonthlyUsd: 29,
    oftenUsedWith: ["Phone Engine", "Ads Engine"],
    requires: ["Domain access", "DNS update"],
  },
  {
    id: "phone",
    name: "Phone Engine",
    doesForYou: "Call forwarding, missed-call capture, SMS follow-up.",
    setupFeeUsd: 149,
    careFeeMonthlyUsd: 39,
    oftenUsedWith: ["Inbox Engine"],
    requires: ["Call forwarding number"],
  },
  {
    id: "social",
    name: "Social Engine",
    doesForYou: "Auto-posting, content loop, weekly schedule.",
    setupFeeUsd: 99,
    careFeeMonthlyUsd: 49,
    oftenUsedWith: ["Inbox Engine"],
    requires: ["IG/FB access"],
  },
  {
    id: "ads",
    name: "Ads Engine",
    doesForYou: "Google Ads starter, tracking, landing alignment.",
    setupFeeUsd: 299,
    careFeeMonthlyUsd: 199,
    oftenUsedWith: ["Inbox Engine", "Phone Engine"],
    requires: ["Google Ads account", "Billing access"],
  },
  {
    id: "books",
    name: "Books Engine",
    doesForYou: "QuickBooks sync, invoicing triggers, client follow-ups.",
    setupFeeUsd: 199,
    careFeeMonthlyUsd: 79,
    oftenUsedWith: ["Inbox Engine"],
    requires: ["QuickBooks OAuth"],
  },
];
