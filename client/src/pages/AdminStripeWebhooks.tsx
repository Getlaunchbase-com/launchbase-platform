import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { RefreshCw, Copy, ChevronDown, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

export default function AdminStripeWebhooks() {
  const [sinceHours, setSinceHours] = useState(24);
  const [status, setStatus] = useState<"all" | "ok" | "failed" | "pending">("all");
  const [retriesOnly, setRetriesOnly] = useState(false);
  const [eventType, setEventType] = useState("");
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const rollupQuery = trpc.admin.stripeWebhooks.rollup.useQuery(
    { sinceHours },
    {
      refetchInterval: 30000, // Auto-refresh every 30s
      retry: false,
    }
  );

  const listQuery = trpc.admin.stripeWebhooks.list.useQuery(
    {
      sinceHours,
      limit: 100,
      status,
      eventType: eventType.trim() || undefined,
      retriesOnly,
    },
    {
      retry: false,
    }
  );

  const handleRefresh = () => {
    rollupQuery.refetch();
    listQuery.refetch();
    toast.success("Webhook data updated");
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Event ID copied to clipboard");
  };

  const toggleRow = (eventId: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(eventId)) {
        next.delete(eventId);
      } else {
        next.add(eventId);
      }
      return next;
    });
  };

  const formatTimestamp = (iso: string | null) => {
    if (!iso) return "—";
    return new Date(iso).toLocaleString();
  };

  const formatUnixTimestamp = (unix: number) => {
    return new Date(unix * 1000).toLocaleString();
  };

  const truncateMeta = (meta: any, maxChars = 200) => {
    if (!meta) return null;
    const str = JSON.stringify(meta, null, 2);
    if (str.length <= maxChars) return str;
    return str.slice(0, maxChars) + "…";
  };

  // Handle admin access errors
  if (rollupQuery.error || listQuery.error) {
    const error = rollupQuery.error || listQuery.error;
    const isAdminError =
      error?.message?.includes("ADMIN_EMAILS") ||
      error?.message?.includes("Forbidden") ||
      error?.message?.includes("admin access");

    return (
      <div className="container py-8">
        <Card className="p-8 text-center">
          <AlertTriangle className="mx-auto h-12 w-12 text-yellow-500 mb-4" />
          <h2 className="text-xl font-semibold mb-2">
            {isAdminError ? "Admin Access Not Configured" : "Error Loading Data"}
          </h2>
          <p className="text-muted-foreground">
            {isAdminError
              ? "ADMIN_EMAILS environment variable is not set or you are not authorized."
              : "Unable to load webhook data. Please try again."}
          </p>
        </Card>
      </div>
    );
  }

  const rollup = rollupQuery.data;
  const list = listQuery.data;

  return (
    <div className="container py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Stripe Webhook Monitor</h1>
          <p className="text-muted-foreground">
            Last updated: {rollup ? formatTimestamp(rollup.lastEventAt) : "—"}
          </p>
        </div>
        <Button onClick={handleRefresh} disabled={rollupQuery.isLoading || listQuery.isLoading}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      {/* Rollup Cards */}
      {rollup && (
        <>
          {rollup.isStale && (
            <Card className="p-4 border-yellow-500 bg-yellow-50 dark:bg-yellow-950">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-yellow-600" />
                <p className="text-sm font-medium">
                  No events received in the last 6 hours. Last event:{" "}
                  {formatTimestamp(rollup.lastEventAt)}
                </p>
              </div>
            </Card>
          )}

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <Card className="p-4">
              <p className="text-sm text-muted-foreground">Total</p>
              <p className="text-2xl font-bold">{rollup.total}</p>
            </Card>
            <Card className="p-4">
              <p className="text-sm text-muted-foreground">OK</p>
              <p className="text-2xl font-bold text-green-600">{rollup.ok}</p>
            </Card>
            <Card className="p-4">
              <p className="text-sm text-muted-foreground">Failed</p>
              <p className="text-2xl font-bold text-red-600">{rollup.failed}</p>
            </Card>
            <Card className="p-4">
              <p className="text-sm text-muted-foreground">Pending</p>
              <p className="text-2xl font-bold text-yellow-600">{rollup.pending}</p>
            </Card>
            <Card className="p-4">
              <p className="text-sm text-muted-foreground">Retry Events</p>
              <p className="text-2xl font-bold">{rollup.retryEvents}</p>
            </Card>
            <Card className="p-4">
              <p className="text-sm text-muted-foreground">Total Retries</p>
              <p className="text-2xl font-bold">{rollup.totalRetries}</p>
            </Card>
          </div>

          {rollup.topTypes.length > 0 && (
            <Card className="p-4">
              <h3 className="font-semibold mb-2">Top Event Types</h3>
              <div className="flex flex-wrap gap-2">
                {rollup.topTypes.map((t: { eventType: string; count: number }) => (
                  <Badge key={t.eventType} variant="secondary">
                    {t.eventType} ({t.count})
                  </Badge>
                ))}
              </div>
            </Card>
          )}
        </>
      )}

      {/* Filters */}
      <Card className="p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="text-sm font-medium mb-2 block">Time Window</label>
            <Select value={sinceHours.toString()} onValueChange={(v) => setSinceHours(Number(v))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">Last 1 hour</SelectItem>
                <SelectItem value="6">Last 6 hours</SelectItem>
                <SelectItem value="24">Last 24 hours</SelectItem>
                <SelectItem value="72">Last 3 days</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">Status</label>
            <Select value={status} onValueChange={(v: any) => setStatus(v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="ok">OK</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">Event Type</label>
            <Input
              placeholder="e.g., checkout.session.completed"
              value={eventType}
              onChange={(e) => setEventType(e.target.value)}
            />
          </div>

          <div className="flex items-end">
            <label className="flex items-center gap-2 cursor-pointer">
              <Checkbox checked={retriesOnly} onCheckedChange={(c) => setRetriesOnly(!!c)} />
              <span className="text-sm font-medium">Retries only</span>
            </label>
          </div>
        </div>
      </Card>

      {/* Events Table */}
      {list && (
        <Card>
          <div className="p-4 border-b">
            <h3 className="font-semibold">
              Events ({list.events.length} of {list.limit} max)
            </h3>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Received At</TableHead>
                  <TableHead>Event Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Retries</TableHead>
                  <TableHead>Idempotency Hit</TableHead>
                  <TableHead>Intake / User</TableHead>
                  <TableHead>Event ID</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.events.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                      No events found
                    </TableCell>
                  </TableRow>
                ) : (
                  list.events.map((event: any) => (
                    <>
                      <TableRow key={event.eventId}>
                        <TableCell className="font-mono text-sm">
                          {formatTimestamp(event.receivedAt)}
                        </TableCell>
                        <TableCell className="font-mono text-sm">{event.eventType}</TableCell>
                        <TableCell>
                          {event.ok === true && (
                            <Badge variant="default" className="bg-green-600">
                              OK
                            </Badge>
                          )}
                          {event.ok === false && (
                            <Badge variant="destructive">Failed</Badge>
                          )}
                          {event.ok === null && (
                            <Badge variant="secondary">Pending</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {event.retryCount > 0 ? (
                            <Badge variant="outline">{event.retryCount}</Badge>
                          ) : (
                            "—"
                          )}
                        </TableCell>
                        <TableCell>
                          {event.idempotencyHit ? (
                            <Badge variant="secondary">Yes</Badge>
                          ) : (
                            "—"
                          )}
                        </TableCell>
                        <TableCell className="font-mono text-sm">
                          {event.intakeId ? `I:${event.intakeId}` : ""}
                          {event.intakeId && event.userId ? " / " : ""}
                          {event.userId ? `U:${event.userId}` : ""}
                          {!event.intakeId && !event.userId ? "—" : ""}
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {event.eventId.slice(0, 16)}…
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => copyToClipboard(event.eventId)}
                            >
                              <Copy className="h-4 w-4" />
                            </Button>
                            {(event.error || event.meta) && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => toggleRow(event.eventId)}
                              >
                                <ChevronDown
                                  className={`h-4 w-4 transition-transform ${
                                    expandedRows.has(event.eventId) ? "rotate-180" : ""
                                  }`}
                                />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                      {expandedRows.has(event.eventId) && (
                        <TableRow>
                          <TableCell colSpan={8} className="bg-muted/50">
                            <div className="p-4 space-y-4">
                              <div>
                                <p className="text-sm font-semibold mb-1">Event ID (full)</p>
                                <p className="font-mono text-xs break-all">{event.eventId}</p>
                              </div>
                              <div>
                                <p className="text-sm font-semibold mb-1">Created</p>
                                <p className="text-sm">{formatUnixTimestamp(event.created)}</p>
                              </div>
                              {event.error && (
                                <div>
                                  <p className="text-sm font-semibold mb-1 text-red-600">Error</p>
                                  <pre className="text-xs bg-red-50 dark:bg-red-950 p-2 rounded overflow-x-auto">
                                    {event.error}
                                  </pre>
                                </div>
                              )}
                              {event.meta && (
                                <Collapsible>
                                  <div>
                                    <CollapsibleTrigger asChild>
                                      <Button variant="outline" size="sm">
                                        Show Metadata
                                      </Button>
                                    </CollapsibleTrigger>
                                    <CollapsibleContent className="mt-2">
                                      <pre className="text-xs bg-muted p-2 rounded overflow-x-auto max-h-96">
                                        {truncateMeta(event.meta, 4000)}
                                      </pre>
                                    </CollapsibleContent>
                                  </div>
                                </Collapsible>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}
    </div>
  );
}
