/**
 * Design Presentation Pass
 *
 * Generates design candidates for an intake's website and selects a winner.
 * This is the "enhanced" tier design pipeline that produces multiple
 * visual variants for comparison.
 */

// ---------------------------------------------------------------------------
// runPresentationPass
// ---------------------------------------------------------------------------

export async function runPresentationPass(input: {
  intakeId: number;
  tenant: string;
  tier: string;
  intakeData: Record<string, unknown>;
  buildPlan: Record<string, unknown>;
  siteSlug: string;
}): Promise<{
  winner?: Record<string, unknown>;
  candidates: any[];
} | null> {
  const { intakeId, tenant, tier, intakeData, buildPlan, siteSlug } = input;

  try {
    const vertical = (intakeData.vertical as string) || "professional";
    const brandColors = (intakeData.brandColors as { primary?: string; secondary?: string }) || {};
    const brandFeel = (intakeData.brandFeel as string) || "clean";
    const businessName = (intakeData.businessName as string) || "Business";

    // Generate design candidates based on vertical and brand feel
    const candidates = generateCandidates(vertical, brandFeel, brandColors);

    if (candidates.length === 0) {
      console.warn(`[presentation-pass] No candidates generated for intake #${intakeId}`);
      return null;
    }

    // Score candidates
    const scoredCandidates = candidates.map((candidate) => ({
      ...candidate,
      score: scoreCandidate(candidate, intakeData),
    }));

    // Sort by score descending
    scoredCandidates.sort((a, b) => b.score - a.score);

    // Winner is the highest-scoring candidate
    const winner = scoredCandidates[0];

    console.log(
      `[presentation-pass] intake #${intakeId}: ${scoredCandidates.length} candidates, winner: "${winner.name}" (score: ${winner.score})`,
    );

    return {
      winner: {
        name: winner.name,
        heroStyle: winner.heroStyle,
        colorScheme: winner.colorScheme,
        layoutVariant: winner.layoutVariant,
        fontPairing: winner.fontPairing,
        score: winner.score,
      },
      candidates: scoredCandidates.map((c) => ({
        name: c.name,
        heroStyle: c.heroStyle,
        colorScheme: c.colorScheme,
        score: c.score,
      })),
    };
  } catch (err) {
    console.error(`[presentation-pass] Error for intake #${intakeId}:`, err);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Candidate generation
// ---------------------------------------------------------------------------

interface DesignCandidate {
  name: string;
  heroStyle: "centered" | "left-aligned" | "split" | "full-bleed";
  colorScheme: {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
  };
  layoutVariant: "classic" | "modern" | "minimal" | "bold";
  fontPairing: {
    heading: string;
    body: string;
  };
  score?: number;
}

function generateCandidates(
  vertical: string,
  brandFeel: string,
  brandColors: { primary?: string; secondary?: string },
): DesignCandidate[] {
  const primary = brandColors.primary || getVerticalColor(vertical);
  const secondary = brandColors.secondary || "#1e293b";

  const candidates: DesignCandidate[] = [
    {
      name: "Clean Professional",
      heroStyle: "centered",
      colorScheme: { primary, secondary, accent: lightenColor(primary), background: "#ffffff" },
      layoutVariant: "classic",
      fontPairing: { heading: "Inter", body: "Inter" },
    },
    {
      name: "Bold Modern",
      heroStyle: "left-aligned",
      colorScheme: { primary, secondary: darkenColor(primary), accent: "#f59e0b", background: "#fafafa" },
      layoutVariant: "modern",
      fontPairing: { heading: "Poppins", body: "Inter" },
    },
    {
      name: "Minimal Elegant",
      heroStyle: "split",
      colorScheme: { primary: "#1e293b", secondary: primary, accent: primary, background: "#ffffff" },
      layoutVariant: "minimal",
      fontPairing: { heading: "Playfair Display", body: "Source Sans Pro" },
    },
    {
      name: "High Energy",
      heroStyle: "full-bleed",
      colorScheme: { primary, secondary: "#0f172a", accent: "#ef4444", background: "#ffffff" },
      layoutVariant: "bold",
      fontPairing: { heading: "Montserrat", body: "Open Sans" },
    },
  ];

  // Add vertical-specific candidate
  if (vertical === "trades") {
    candidates.push({
      name: "Contractor Pro",
      heroStyle: "left-aligned",
      colorScheme: { primary: "#1d4ed8", secondary: "#0f172a", accent: "#f97316", background: "#f8fafc" },
      layoutVariant: "bold",
      fontPairing: { heading: "Roboto", body: "Roboto" },
    });
  }

  return candidates;
}

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------

function scoreCandidate(
  candidate: DesignCandidate,
  intakeData: Record<string, unknown>,
): number {
  let score = 50;

  const brandFeel = (intakeData.brandFeel as string) || "clean";
  const vertical = (intakeData.vertical as string) || "professional";

  // Brand feel matching
  if (brandFeel === "clean" && candidate.layoutVariant === "classic") score += 15;
  if (brandFeel === "modern" && candidate.layoutVariant === "modern") score += 15;
  if (brandFeel === "bold" && candidate.layoutVariant === "bold") score += 15;
  if (brandFeel === "minimal" && candidate.layoutVariant === "minimal") score += 15;

  // Vertical matching
  if (vertical === "trades" && candidate.heroStyle === "left-aligned") score += 10;
  if (vertical === "appointments" && candidate.heroStyle === "centered") score += 10;
  if (vertical === "professional" && candidate.layoutVariant !== "bold") score += 10;

  // Penalize mismatches
  if (vertical === "professional" && candidate.layoutVariant === "bold") score -= 5;
  if (vertical === "trades" && candidate.layoutVariant === "minimal") score -= 5;

  // Bonus for named vertical candidates
  if (candidate.name.toLowerCase().includes(vertical)) score += 10;

  return Math.max(0, Math.min(100, score));
}

// ---------------------------------------------------------------------------
// Color helpers
// ---------------------------------------------------------------------------

function getVerticalColor(vertical: string): string {
  const colors: Record<string, string> = {
    trades: "#2563eb",
    appointments: "#7c3aed",
    professional: "#0f766e",
  };
  return colors[vertical] || "#2563eb";
}

function lightenColor(hex: string): string {
  try {
    const r = Math.min(255, parseInt(hex.slice(1, 3), 16) + 60);
    const g = Math.min(255, parseInt(hex.slice(3, 5), 16) + 60);
    const b = Math.min(255, parseInt(hex.slice(5, 7), 16) + 60);
    return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
  } catch { return hex; }
}

function darkenColor(hex: string): string {
  try {
    const r = Math.max(0, parseInt(hex.slice(1, 3), 16) - 40);
    const g = Math.max(0, parseInt(hex.slice(3, 5), 16) - 40);
    const b = Math.max(0, parseInt(hex.slice(5, 7), 16) - 40);
    return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
  } catch { return hex; }
}
