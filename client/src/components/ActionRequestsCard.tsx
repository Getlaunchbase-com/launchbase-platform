import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { 
  Mail, 
  Clock, 
  ChevronDown, 
  Send, 
  Ban, 
  Unlock, 
  CheckCircle,
  AlertCircle,
  RefreshCw
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

interface ActionRequestsCardProps {
  intakeId: number;
}

// Status badge colors
const statusColors: Record<string, string> = {
  pending: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  sent: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  responded: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  applied: "bg-green-500/20 text-green-400 border-green-500/30",
  locked: "bg-gray-500/20 text-gray-400 border-gray-500/30",
  needs_human: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  expired: "bg-red-500/20 text-red-400 border-red-500/30",
};

export default function ActionRequestsCard({ intakeId }: ActionRequestsCardProps) {
  const [showAdminApplyModal, setShowAdminApplyModal] = useState(false);
  const [showExpireModal, setShowExpireModal] = useState(false);
  const [showUnlockModal, setShowUnlockModal] = useState(false);
  const [selectedRequestId, setSelectedRequestId] = useState<number | null>(null);
  const [adminApplyValue, setAdminApplyValue] = useState("");
  const [adminApplyReason, setAdminApplyReason] = useState("");
  const [expireReason, setExpireReason] = useState("");
  const [unlockReason, setUnlockReason] = useState("");
  const [expandedEvents, setExpandedEvents] = useState<Record<number, boolean>>({});

  // Queries
  const { data: requests, refetch: refetchRequests } = trpc.actionRequests.listByIntake.useQuery({ intakeId });
  const { data: stats } = trpc.actionRequests.getStats.useQuery({ intakeId });

  // Mutations
  const resendMutation = trpc.actionRequests.resend.useMutation({
    onSuccess: (data) => {
      if (data.ok) {
        toast.success("Email resent successfully");
        refetchRequests();
      } else if (data.code === "rate_limited") {
        toast.error(`Rate limited. ${data.message}`);
      } else {
        toast.error(data.message || "Failed to resend");
      }
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const adminApplyMutation = trpc.actionRequests.adminApply.useMutation({
    onSuccess: () => {
      toast.success("Applied successfully");
      setShowAdminApplyModal(false);
      setAdminApplyValue("");
      setAdminApplyReason("");
      refetchRequests();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const expireMutation = trpc.actionRequests.expire.useMutation({
    onSuccess: () => {
      toast.success("Request expired");
      setShowExpireModal(false);
      setExpireReason("");
      refetchRequests();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const unlockMutation = trpc.actionRequests.unlock.useMutation({
    onSuccess: () => {
      toast.success("Request unlocked");
      setShowUnlockModal(false);
      setUnlockReason("");
      refetchRequests();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const handleResend = (id: number) => {
    resendMutation.mutate({ id });
  };

  const handleAdminApply = () => {
    if (!selectedRequestId || !adminApplyReason.trim()) return;
    adminApplyMutation.mutate({
      id: selectedRequestId,
      finalValue: adminApplyValue,
      reason: adminApplyReason,
    });
  };

  const handleExpire = () => {
    if (!selectedRequestId || !expireReason.trim()) return;
    expireMutation.mutate({
      id: selectedRequestId,
      reason: expireReason,
    });
  };

  const handleUnlock = () => {
    if (!selectedRequestId || !unlockReason.trim()) return;
    unlockMutation.mutate({
      id: selectedRequestId,
      reason: unlockReason,
    });
  };

  const openAdminApplyModal = (requestId: number, currentValue: unknown) => {
    setSelectedRequestId(requestId);
    setAdminApplyValue(typeof currentValue === "string" ? currentValue : JSON.stringify(currentValue, null, 2));
    setShowAdminApplyModal(true);
  };

  const openExpireModal = (requestId: number) => {
    setSelectedRequestId(requestId);
    setShowExpireModal(true);
  };

  const openUnlockModal = (requestId: number) => {
    setSelectedRequestId(requestId);
    setShowUnlockModal(true);
  };

  const toggleEvents = (requestId: number) => {
    setExpandedEvents(prev => ({ ...prev, [requestId]: !prev[requestId] }));
  };

  if (!requests || requests.length === 0) {
    return null; // Don't show card if no action requests
  }

  return (
    <>
      <Card className="bg-white/5 border-white/10">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="w-5 h-5 text-[#FF6A00]" />
            Action Requests
          </CardTitle>
          <CardDescription>
            Ask → Understand → Apply → Confirm loop
            {stats && (
              <span className="ml-2 text-xs">
                ({stats.pending} pending, {stats.needsHuman} need review, {stats.locked} locked)
              </span>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {requests.map((request) => (
            <div key={request.id} className="border border-white/10 rounded-lg p-4 space-y-3">
              {/* Header Row */}
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-gray-200">{request.checklistKey}</span>
                    <Badge className={statusColors[request.status] || "bg-gray-500/20 text-gray-400"}>
                      {request.status}
                    </Badge>
                  </div>
                  <div className="text-sm text-gray-400">
                    Proposed: {typeof request.proposedValue === "string" 
                      ? request.proposedValue 
                      : JSON.stringify(request.proposedValue)}
                  </div>
                </div>
              </div>

              {/* Metadata Row */}
              <div className="flex items-center gap-4 text-xs text-gray-500">
                <div className="flex items-center gap-1">
                  <Send className="w-3 h-3" />
                  <span>Sent {request.sendCount} time{request.sendCount !== 1 ? "s" : ""}</span>
                </div>
                {request.lastSentAt && (
                  <div className="flex items-center gap-1" title={new Date(request.lastSentAt).toLocaleString()}>
                    <Clock className="w-3 h-3" />
                    <span>{formatDistanceToNow(new Date(request.lastSentAt), { addSuffix: true })}</span>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 flex-wrap">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleResend(request.id)}
                  disabled={
                    request.status !== "pending" || 
                    resendMutation.isPending ||
                    !!(request.lastSentAt && 
                      new Date().getTime() - new Date(request.lastSentAt).getTime() < 10 * 60 * 1000)
                  }
                  className="text-blue-400 border-blue-400/30 hover:bg-blue-400/10"
                >
                  <RefreshCw className="w-3 h-3 mr-1" />
                  Resend
                  {request.lastSentAt && 
                    new Date().getTime() - new Date(request.lastSentAt).getTime() < 10 * 60 * 1000 && (
                      <span className="ml-1 text-xs">
                        (wait {Math.ceil((10 * 60 * 1000 - (new Date().getTime() - new Date(request.lastSentAt).getTime())) / 60000)}m)
                      </span>
                    )}
                </Button>

                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => openAdminApplyModal(request.id, request.proposedValue)}
                  className="text-green-400 border-green-400/30 hover:bg-green-400/10"
                >
                  <CheckCircle className="w-3 h-3 mr-1" />
                  Admin Apply
                </Button>

                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => openExpireModal(request.id)}
                  disabled={request.status !== "pending" && request.status !== "needs_human"}
                  className="text-red-400 border-red-400/30 hover:bg-red-400/10"
                >
                  <Ban className="w-3 h-3 mr-1" />
                  Expire
                </Button>

                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => openUnlockModal(request.id)}
                  disabled={request.status !== "locked" && request.status !== "applied"}
                  className="text-yellow-400 border-yellow-400/30 hover:bg-yellow-400/10"
                >
                  <Unlock className="w-3 h-3 mr-1" />
                  Unlock
                </Button>
              </div>

              {/* Recent Activity (Collapsible) */}
              <ActionRequestEvents 
                requestId={request.id} 
                isExpanded={expandedEvents[request.id] || false}
                onToggle={() => toggleEvents(request.id)}
              />
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Admin Apply Modal */}
      <Dialog open={showAdminApplyModal} onOpenChange={setShowAdminApplyModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Admin Apply</DialogTitle>
            <DialogDescription>
              Manually apply this action request. Requires a reason for audit trail.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-300 mb-2 block">Final Value</label>
              <Textarea
                value={adminApplyValue}
                onChange={(e) => setAdminApplyValue(e.target.value)}
                placeholder="Enter the final value to apply..."
                className="min-h-24 font-mono text-sm"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-300 mb-2 block">Reason (Required)</label>
              <Input
                value={adminApplyReason}
                onChange={(e) => setAdminApplyReason(e.target.value)}
                placeholder="Why are you manually applying this?"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdminApplyModal(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleAdminApply}
              disabled={!adminApplyReason.trim() || adminApplyMutation.isPending}
              className="bg-green-600 hover:bg-green-600/90"
            >
              <CheckCircle className="w-4 h-4 mr-2" />
              {adminApplyMutation.isPending ? "Applying..." : "Apply"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Expire Modal */}
      <Dialog open={showExpireModal} onOpenChange={setShowExpireModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Expire Action Request</DialogTitle>
            <DialogDescription>
              Mark this request as expired. Requires a reason for audit trail.
            </DialogDescription>
          </DialogHeader>
          <div>
            <label className="text-sm font-medium text-gray-300 mb-2 block">Reason (Required)</label>
            <Input
              value={expireReason}
              onChange={(e) => setExpireReason(e.target.value)}
              placeholder="Why are you expiring this request?"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowExpireModal(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleExpire}
              disabled={!expireReason.trim() || expireMutation.isPending}
              className="bg-red-600 hover:bg-red-600/90"
            >
              <Ban className="w-4 h-4 mr-2" />
              {expireMutation.isPending ? "Expiring..." : "Expire"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Unlock Modal */}
      <Dialog open={showUnlockModal} onOpenChange={setShowUnlockModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Unlock Action Request</DialogTitle>
            <DialogDescription>
              Unlock this request for re-processing. Will be set to "needs_human" status. Requires a reason for audit trail.
            </DialogDescription>
          </DialogHeader>
          <div>
            <label className="text-sm font-medium text-gray-300 mb-2 block">Reason (Required)</label>
            <Input
              value={unlockReason}
              onChange={(e) => setUnlockReason(e.target.value)}
              placeholder="Why are you unlocking this request?"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowUnlockModal(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleUnlock}
              disabled={!unlockReason.trim() || unlockMutation.isPending}
              className="bg-yellow-600 hover:bg-yellow-600/90"
            >
              <Unlock className="w-4 h-4 mr-2" />
              {unlockMutation.isPending ? "Unlocking..." : "Unlock"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// Sub-component for recent events
function ActionRequestEvents({ 
  requestId, 
  isExpanded, 
  onToggle 
}: { 
  requestId: number; 
  isExpanded: boolean; 
  onToggle: () => void;
}) {
  const { data: events } = trpc.actionRequests.getEvents.useQuery(
    { actionRequestId: requestId, limit: 5 },
    { enabled: isExpanded }
  );

  return (
    <Collapsible open={isExpanded} onOpenChange={onToggle}>
      <CollapsibleTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-between text-gray-400 hover:text-gray-200"
        >
          <span className="text-xs">Recent Activity</span>
          <ChevronDown className={`w-4 h-4 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-2 space-y-2">
        {events && events.length > 0 ? (
          events.map((event) => (
            <div key={event.id} className="text-xs bg-white/5 rounded p-2 space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-medium text-gray-300">{event.eventType}</span>
                <span className="text-gray-500" title={new Date(event.createdAt).toLocaleString()}>
                  {formatDistanceToNow(new Date(event.createdAt), { addSuffix: true })}
                </span>
              </div>
              <div className="text-gray-400">
                Actor: {event.actorType}
                {event.actorId && ` (${event.actorId})`}
              </div>
              {event.reason && (
                <div className="text-gray-400">
                  Reason: {event.reason}
                </div>
              )}
            </div>
          ))
        ) : (
          <div className="text-xs text-gray-500 text-center py-2">
            No events yet
          </div>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}
