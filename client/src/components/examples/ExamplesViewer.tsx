import React, { useMemo, useState } from "react";

type TierKey = "before" | "standard" | "growth" | "premium";

type ExampleSet = {
  id: string;
  name: string;
  headline: string;
  subhead: string;
  tiers: Record<TierKey, { label: string; imgSrc: string; blurb: string }>;
};

const DEFAULT_EXAMPLE: ExampleSet = {
  id: "launchbase",
  name: "LaunchBase",
  headline: "See what you get at each tier",
  subhead: "Real transformations, not feature lists.",
  tiers: {
    before: {
      label: "Before",
      imgSrc: "/examples/launchbase-before.png",
      blurb: "Your starting point — functional, but not optimized for clarity or conversion.",
    },
    standard: {
      label: "Standard",
      imgSrc: "/examples/launchbase-standard.png",
      blurb: "Polish pass — tightened messaging, better spacing, clearer CTA hierarchy.",
    },
    growth: {
      label: "Growth",
      imgSrc: "/examples/launchbase-growth.png",
      blurb: "Conversion pass — trust strip, outcome bullets, proof elements.",
    },
    premium: {
      label: "Premium",
      imgSrc: "/examples/launchbase-premium.png",
      blurb: "Full transformation — premium positioning + design system + strongest hierarchy.",
    },
  },
};

export function ExamplesViewer({ example = DEFAULT_EXAMPLE }: { example?: ExampleSet }) {
  const tiers = useMemo(() => Object.keys(example.tiers) as TierKey[], [example.tiers]);
  const [active, setActive] = useState<TierKey>("premium");

  const activeTier = example.tiers[active];

  return (
    <section className="mx-auto max-w-6xl px-4 py-16">
      <div className="mb-8 flex flex-col gap-3">
        <h2 className="text-3xl font-semibold tracking-tight">{example.headline}</h2>
        <p className="text-muted-foreground">{example.subhead}</p>
      </div>

      <div className="grid gap-8 lg:grid-cols-[360px_1fr]">
        {/* Left: tier controls */}
        <div className="rounded-2xl border bg-background p-4 lg:p-6">
          <div className="mb-3 text-sm font-medium text-muted-foreground">
            Example: <span className="text-foreground">{example.name}</span>
          </div>

          <div className="flex flex-wrap gap-2">
            {tiers.map((k) => {
              const isActive = k === active;
              return (
                <button
                  key={k}
                  onClick={() => setActive(k)}
                  className={[
                    "rounded-full px-4 py-2 text-sm transition",
                    "border",
                    isActive
                      ? "bg-foreground text-background border-foreground"
                      : "bg-background text-foreground hover:bg-muted",
                  ].join(" ")}
                  aria-pressed={isActive}
                >
                  {example.tiers[k].label}
                </button>
              );
            })}
          </div>

          <div className="mt-4">
            <div className="text-lg font-semibold">{activeTier.label}</div>
            <p className="mt-1 text-sm text-muted-foreground">{activeTier.blurb}</p>
          </div>

          <div className="mt-6 text-xs text-muted-foreground">
            Tip: Use <span className="font-medium">Growth</span> when you want conversion lift, and{" "}
            <span className="font-medium">Premium</span> for full positioning + design system.
          </div>
        </div>

        {/* Right: image */}
        <div className="rounded-2xl border bg-background p-3 lg:p-4">
          <div className="overflow-hidden rounded-xl border bg-muted">
            <img
              src={activeTier.imgSrc}
              alt={`${example.name} ${activeTier.label} example`}
              className="h-auto w-full select-none"
              loading="lazy"
              draggable={false}
            />
          </div>

          <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
            <span>{example.name}</span>
            <span>{activeTier.label}</span>
          </div>
        </div>
      </div>
    </section>
  );
}
