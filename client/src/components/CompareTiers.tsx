import { Link } from "wouter";
import { Check, X } from "lucide-react";

const tiers = [
  {
    name: "Standard",
    credits: 1,
    features: {
      "Website + copy improvements": true,
      "Conversion structure + CTA hierarchy": false,
      "Full redesign / design system pass": false,
      "Preview before publish": true,
      "Request changes (1 credit per request)": true,
      "Optional add-on engines (Inbox/Phone/Social/Ads/Books)": true,
    },
  },
  {
    name: "Growth",
    credits: 3,
    features: {
      "Website + copy improvements": true,
      "Conversion structure + CTA hierarchy": true,
      "Full redesign / design system pass": false,
      "Preview before publish": true,
      "Request changes (1 credit per request)": true,
      "Optional add-on engines (Inbox/Phone/Social/Ads/Books)": true,
    },
  },
  {
    name: "Premium",
    credits: 10,
    recommended: true,
    features: {
      "Website + copy improvements": true,
      "Conversion structure + CTA hierarchy": true,
      "Full redesign / design system pass": true,
      "Preview before publish": true,
      "Request changes (1 credit per request)": true,
      "Optional add-on engines (Inbox/Phone/Social/Ads/Books)": true,
    },
  },
];

const featureList = [
  "Website + copy improvements",
  "Conversion structure + CTA hierarchy",
  "Full redesign / design system pass",
  "Preview before publish",
  "Request changes (1 credit per request)",
  "Optional add-on engines (Inbox/Phone/Social/Ads/Books)",
] as const;

type FeatureKey = (typeof featureList)[number];
type TierFeatures = Record<FeatureKey, boolean>;

export default function CompareTiers() {
  return (
    <div className="mb-20">
      <h2 className="text-3xl font-semibold mb-4 text-center">Compare tiers</h2>
      <p className="text-white/60 text-center mb-12">
        See what's included in each tier and choose the right level of transformation for your business.
      </p>

      {/* Mobile: Stacked cards */}
      <div className="md:hidden space-y-6">
        {tiers.map((tier) => (
          <div
            key={tier.name}
            className="rounded-2xl border border-white/10 bg-white/5 p-6"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-semibold">{tier.name}</h3>
              {tier.recommended && (
                <span className="text-xs bg-[#FF6A00] text-black px-2 py-1 rounded-full font-medium">
                  Recommended
                </span>
              )}
            </div>
            <p className="text-2xl font-bold text-[#FF6A00] mb-6">
              {tier.credits} {tier.credits === 1 ? "credit" : "credits"}
            </p>
            <ul className="space-y-3 mb-6">
              {featureList.map((feature) => (
                <li key={feature} className="flex items-start gap-2 text-sm">
                  {tier.features[feature] ? (
                    <Check className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                  ) : (
                    <X className="w-5 h-5 text-white/30 flex-shrink-0 mt-0.5" />
                  )}
                  <span className={tier.features[feature] ? "text-white/90" : "text-white/40"}>
                    {feature}
                  </span>
                </li>
              ))}
            </ul>
            <Link
              href="/apply"
              className="block w-full text-center rounded-xl bg-[#FF6A00] px-4 py-3 text-sm font-medium text-black hover:brightness-110 transition"
            >
              Get started
            </Link>
          </div>
        ))}
      </div>

      {/* Desktop: Table */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className="text-left p-4 border-b border-white/10 text-white/60 font-medium">
                Features
              </th>
              {tiers.map((tier) => (
                <th
                  key={tier.name}
                  className="p-4 border-b border-white/10 text-center"
                >
                  <div className="flex flex-col items-center gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-semibold">{tier.name}</span>
                      {tier.recommended && (
                        <span className="text-xs bg-[#FF6A00] text-black px-2 py-1 rounded-full font-medium">
                          Recommended
                        </span>
                      )}
                    </div>
                    <span className="text-2xl font-bold text-[#FF6A00]">
                      {tier.credits} {tier.credits === 1 ? "credit" : "credits"}
                    </span>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {featureList.map((feature, idx) => (
              <tr key={feature} className={idx % 2 === 0 ? "bg-white/[0.02]" : ""}>
                <td className="p-4 text-sm text-white/80">{feature}</td>
                {tiers.map((tier) => (
                  <td key={tier.name} className="p-4 text-center">
                    {tier.features[feature] ? (
                      <Check className="w-5 h-5 text-green-500 mx-auto" />
                    ) : (
                      <X className="w-5 h-5 text-white/30 mx-auto" />
                    )}
                  </td>
                ))}
              </tr>
            ))}
            <tr>
              <td className="p-4"></td>
              {tiers.map((tier) => (
                <td key={tier.name} className="p-4">
                  <Link
                    href="/apply"
                    className="block w-full text-center rounded-xl bg-[#FF6A00] px-4 py-3 text-sm font-medium text-black hover:brightness-110 transition"
                  >
                    Get started
                  </Link>
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>

      {/* What's a credit? explainer */}
      <div className="mt-8 rounded-xl border border-white/10 bg-white/5 p-6">
        <h3 className="text-lg font-semibold mb-3">What's a credit?</h3>
        <p className="text-sm text-white/70 mb-3">
          Each time you request changes to your site, it consumes 1 credit. Approving a version consumes 0 credits.
        </p>
        <p className="text-sm text-white/70">
          Credits limit iteration so the process stays fast and focused. When credits run out, you can purchase more.
        </p>
      </div>
    </div>
  );
}
