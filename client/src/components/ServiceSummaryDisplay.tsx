/**
 * ServiceSummaryDisplay
 * 
 * Displays service summary from tRPC query result (lines + totals).
 * Used in CustomerPreview page.
 */

interface ServiceSummaryDisplayProps {
  lines: string[];
  totals: {
    setupCents: number;
    monthlyCents: number;
  };
  showNote?: boolean;
}

export function ServiceSummaryDisplay({ lines, totals, showNote = false }: ServiceSummaryDisplayProps) {
  if (lines.length === 0) {
    return null;
  }
  
  return (
    <div className="bg-white/5 border border-white/10 rounded-lg p-6">
      <h3 className="text-xl font-bold mb-4">Services You Selected</h3>
      
      <div className="space-y-3 mb-6">
        {lines.map((line, idx) => (
          <div key={idx} className="flex items-start gap-3">
            <div className="w-2 h-2 bg-[#FF6A00] rounded-full mt-2 flex-shrink-0" />
            <p className="text-gray-300">{line}</p>
          </div>
        ))}
      </div>
      
      <div className="pt-4 border-t border-white/10 space-y-2">
        <div className="flex justify-between items-center">
          <span className="text-gray-400">Setup Total</span>
          <span className="text-white font-bold">${(totals.setupCents / 100).toFixed(0)}</span>
        </div>
        {totals.monthlyCents > 0 && (
          <div className="flex justify-between items-center">
            <span className="text-gray-400">Monthly Total</span>
            <span className="text-white font-bold">${(totals.monthlyCents / 100).toFixed(0)}/mo</span>
          </div>
        )}
      </div>
      
      {showNote && (
        <p className="text-sm text-gray-500 mt-4">
          Monthly billing starts after your site launches. Cancel any service anytime.
        </p>
      )}
    </div>
  );
}
