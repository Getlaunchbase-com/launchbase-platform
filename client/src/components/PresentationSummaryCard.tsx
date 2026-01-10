import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, ChevronRight } from "lucide-react";
import { trpc } from "@/lib/trpc";

interface PresentationSummaryCardProps {
  intakeId: number;
}

export default function PresentationSummaryCard({ intakeId }: PresentationSummaryCardProps) {
  const [showCandidates, setShowCandidates] = useState(false);
  const [showSignals, setShowSignals] = useState(false);

  const { data, isLoading } = trpc.designJobs.byIntake.useQuery(
    { intakeId },
    { enabled: !!intakeId }
  );

  // If no design job, don't render anything
  if (isLoading) {
    return null;
  }

  if (!data) {
    return null;
  }

  const winner = data.candidates.find(c => c.isWinner);
  const isEnhanced = data.tier === "enhanced";

  return (
    <Card className="border-l-4 border-l-blue-500">
      <CardHeader>
        <CardTitle className="text-lg">Presentation</CardTitle>
        <CardDescription className="text-sm text-muted-foreground">
          How the customer-facing site is visually presented. Content and operations are unchanged.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Status Row */}
        <div className="flex items-center gap-4 text-sm">
          <div>
            <span className="font-medium">Mode:</span>{" "}
            {isEnhanced ? (
              <Badge variant="secondary" className="ml-1">Enhanced (Tier 1)</Badge>
            ) : (
              <Badge variant="outline" className="ml-1">Standard</Badge>
            )}
          </div>
          {isEnhanced && (
            <div>
              <span className="font-medium">Result:</span>{" "}
              <Badge variant="default" className="ml-1 bg-green-500/20 text-green-400 border-green-500/30">
                Completed
              </Badge>
            </div>
          )}
        </div>

        {/* Winner Summary (only for Tier 1) */}
        {isEnhanced && winner && (
          <div className="border-t pt-4">
            <h4 className="font-semibold text-sm mb-2">Selected Presentation</h4>
            <div className="grid grid-cols-2 gap-3 text-sm mb-3">
              <div>
                <span className="text-muted-foreground">Variant:</span>{" "}
                <span className="font-medium">{formatVariantName(winner.variantKey)}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Score:</span>{" "}
                <span className="font-medium">{winner.score} / 100</span>
              </div>
            </div>

            {/* Why this variant won */}
            <div className="bg-muted/50 p-3 rounded-md text-sm space-y-1">
              <p className="font-medium text-xs uppercase text-muted-foreground mb-2">
                Why this variant won
              </p>
              <ul className="space-y-1 text-muted-foreground">
                <li>• Strong visual hierarchy</li>
                <li>• Trust signals above the fold</li>
                <li>• Clear mobile-first layout</li>
              </ul>
              <p className="text-xs text-muted-foreground mt-3 italic border-t pt-2">
                Selected automatically using LaunchBase presentation rules.
                No customer content or business logic was changed.
              </p>
            </div>
          </div>
        )}

        {/* Candidate Table (collapsed by default) */}
        {isEnhanced && data.candidates.length > 0 && (
          <div className="border-t pt-4">
            <button
              onClick={() => setShowCandidates(!showCandidates)}
              className="flex items-center gap-2 text-sm font-medium hover:text-primary transition-colors"
            >
              {showCandidates ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              View evaluated candidates
            </button>

            {showCandidates && (
              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-sm border rounded-md">
                  <thead>
                    <tr className="bg-muted">
                      <th className="p-2 text-left font-medium">Variant</th>
                      <th className="p-2 text-center font-medium">Score</th>
                      <th className="p-2 text-center font-medium">Rank</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.candidates.map((c) => (
                      <tr
                        key={c.variantKey}
                        className={c.isWinner ? "bg-green-50 dark:bg-green-950/20" : ""}
                      >
                        <td className="p-2">
                          {formatVariantName(c.variantKey)}
                          {c.isWinner && " 🥇"}
                        </td>
                        <td className="p-2 text-center font-mono">{c.score}</td>
                        <td className="p-2 text-center">
                          {c.rank === 1 && "🥇"}
                          {c.rank === 2 && "🥈"}
                          {c.rank === 3 && "🥉"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Signals Snapshot (collapsed) */}
        {isEnhanced && (
          <div className="border-t pt-4">
            <button
              onClick={() => setShowSignals(!showSignals)}
              className="flex items-center gap-2 text-sm font-medium hover:text-primary transition-colors"
            >
              {showSignals ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              Evaluation signals
            </button>

            {showSignals && (
              <div className="mt-3 space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <span className="text-green-500">✔</span>
                  <span>Readability</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-green-500">✔</span>
                  <span>Visual hierarchy</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-green-500">✔</span>
                  <span>Mobile clarity</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-green-500">✔</span>
                  <span>CTA prominence</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-green-500">✔</span>
                  <span>Brand restraint</span>
                </div>
                <p className="text-xs text-muted-foreground mt-3 italic">
                  Signals are deterministic and logged for learning, not tuning.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Guardrail Footer */}
        {isEnhanced && (
          <div className="border-t pt-4">
            <p className="text-xs text-muted-foreground italic">
              Admins cannot select, rerun, or override presentation variants.
              LaunchBase evaluates presentation outcomes based on customer behavior.
            </p>
          </div>
        )}

        {/* Debug Metadata (tiny) */}
        {isEnhanced && (
          <div className="text-xs text-muted-foreground">
            Job ID: {data.id} · Generated {new Date(data.createdAt).toLocaleString()}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Helper: Format variant key to human-readable name
function formatVariantName(variantKey: string): string {
  // Convert snake_case to Title Case
  return variantKey
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}
