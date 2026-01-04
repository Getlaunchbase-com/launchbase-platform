/**
 * Admin Drafts Review Page
 * Internal admin page for reviewing and approving social media drafts
 * 
 * URL: /admin/drafts
 */

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  MessageSquare,
  Calendar,
  Sparkles,
  PauseCircle,
} from "lucide-react";

interface Draft {
  id: number;
  content: string;
  status: string;
  postType: string | null;
  whyWeWroteThis: string | null;
  reasonChips: string[] | null;
  confidenceScore: number | null;
  createdAt: string;
  expiresAt: string | null;
}

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case "needs_review":
      return <Badge variant="outline" className="bg-yellow-500/10 text-yellow-500 border-yellow-500/20">Needs Review</Badge>;
    case "approved":
      return <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/20">Approved</Badge>;
    case "published":
      return <Badge variant="outline" className="bg-blue-500/10 text-blue-500 border-blue-500/20">Published</Badge>;
    case "held":
      return <Badge variant="outline" className="bg-orange-500/10 text-orange-500 border-orange-500/20">Held</Badge>;
    case "rejected":
      return <Badge variant="outline" className="bg-red-500/10 text-red-500 border-red-500/20">Rejected</Badge>;
    case "expired":
      return <Badge variant="outline" className="bg-gray-500/10 text-gray-500 border-gray-500/20">Expired</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

function DraftCard({ 
  draft, 
  onApprove, 
  onHold,
  isApproving,
  isHolding,
}: { 
  draft: Draft;
  onApprove: () => void;
  onHold: () => void;
  isApproving: boolean;
  isHolding: boolean;
}) {
  const isExpired = draft.expiresAt && new Date(draft.expiresAt) < new Date();
  const canAction = draft.status === "needs_review" && !isExpired;

  return (
    <Card className="mb-4">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <StatusBadge status={draft.status} />
              {draft.postType && (
                <Badge variant="secondary" className="text-xs">
                  {draft.postType}
                </Badge>
              )}
              {draft.confidenceScore && (
                <Badge variant="outline" className="text-xs">
                  {draft.confidenceScore}% confidence
                </Badge>
              )}
            </div>
            <CardDescription className="flex items-center gap-2 text-xs">
              <Calendar className="h-3 w-3" />
              Created {new Date(draft.createdAt).toLocaleString()}
              {draft.expiresAt && (
                <>
                  <span className="text-muted-foreground">•</span>
                  <Clock className="h-3 w-3" />
                  {isExpired ? (
                    <span className="text-red-500">Expired</span>
                  ) : (
                    <>Expires {new Date(draft.expiresAt).toLocaleString()}</>
                  )}
                </>
              )}
            </CardDescription>
          </div>
          <div className="text-right text-xs text-muted-foreground">
            ID: {draft.id}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Draft Content */}
        <div className="bg-muted/50 rounded-lg p-4">
          <p className="whitespace-pre-wrap text-sm">{draft.content}</p>
        </div>

        {/* Why We Wrote This */}
        {draft.whyWeWroteThis && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Sparkles className="h-4 w-4 text-orange-500" />
              Why We Wrote This
            </div>
            <p className="text-sm text-muted-foreground pl-6">
              {draft.whyWeWroteThis}
            </p>
          </div>
        )}

        {/* Reason Chips */}
        {draft.reasonChips && draft.reasonChips.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {draft.reasonChips.map((chip, i) => (
              <Badge key={i} variant="secondary" className="text-xs">
                {chip}
              </Badge>
            ))}
          </div>
        )}

        {/* Action Buttons */}
        {canAction && (
          <>
            <Separator />
            <div className="flex gap-2">
              <Button
                onClick={onApprove}
                disabled={isApproving || isHolding}
                className="flex-1"
              >
                {isApproving ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                )}
                Approve & Publish
              </Button>
              <Button
                variant="outline"
                onClick={onHold}
                disabled={isApproving || isHolding}
              >
                {isHolding ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <PauseCircle className="h-4 w-4 mr-2" />
                )}
                Hold
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

export default function AdminDrafts() {
  const [selectedDraftId, setSelectedDraftId] = useState<number | null>(null);
  const [actionType, setActionType] = useState<"approve" | "hold" | null>(null);
  const [showResultDialog, setShowResultDialog] = useState(false);
  const [resultMessage, setResultMessage] = useState<{ success: boolean; message: string } | null>(null);

  // Fetch drafts
  const draftsQuery = trpc.platform.listDrafts.useQuery({});

  // Approve mutation
  const approveMutation = trpc.platform.approveDraft.useMutation({
    onSuccess: (data) => {
      setResultMessage({
        success: data.status === "published",
        message: data.status === "published"
          ? `Draft published successfully! External ID: ${data.externalId || "N/A"}`
          : `Draft held: ${data.reason || "Safety check triggered"}`,
      });
      setShowResultDialog(true);
      draftsQuery.refetch();
    },
    onError: (error) => {
      setResultMessage({
        success: false,
        message: error.message || "Failed to process draft",
      });
      setShowResultDialog(true);
    },
    onSettled: () => {
      setSelectedDraftId(null);
      setActionType(null);
    },
  });

  // Create test draft mutation
  const createTestDraftMutation = trpc.platform.createTestDraft.useMutation({
    onSuccess: () => {
      draftsQuery.refetch();
    },
  });

  const handleApprove = (draftId: number) => {
    setSelectedDraftId(draftId);
    setActionType("approve");
    approveMutation.mutate({ draftId });
  };

  const handleHold = (draftId: number) => {
    setSelectedDraftId(draftId);
    setActionType("hold");
    // For now, hold is just a manual status update - could add a holdDraft mutation
    setResultMessage({
      success: true,
      message: "Draft held. Manual hold feature coming soon.",
    });
    setShowResultDialog(true);
    setSelectedDraftId(null);
    setActionType(null);
  };

  const pendingDrafts = draftsQuery.data?.drafts?.filter(d => d.status === "needs_review") || [];
  const otherDrafts = draftsQuery.data?.drafts?.filter(d => d.status !== "needs_review") || [];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Drafts Review</h1>
            <p className="text-muted-foreground">
              Review and approve social media drafts before publishing
            </p>
          </div>
          <Button
            variant="outline"
            onClick={() => createTestDraftMutation.mutate({})}
            disabled={createTestDraftMutation.isPending}
          >
            {createTestDraftMutation.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <MessageSquare className="h-4 w-4 mr-2" />
            )}
            Create Test Draft
          </Button>
        </div>

        {/* Loading State */}
        {draftsQuery.isLoading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        )}

        {/* Error State */}
        {draftsQuery.isError && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>
              Failed to load drafts. Please try again.
            </AlertDescription>
          </Alert>
        )}

        {/* Pending Drafts */}
        {!draftsQuery.isLoading && (
          <>
            <div>
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Clock className="h-5 w-5 text-yellow-500" />
                Pending Review ({pendingDrafts.length})
              </h2>
              {pendingDrafts.length === 0 ? (
                <Card>
                  <CardContent className="py-8 text-center text-muted-foreground">
                    No drafts pending review
                  </CardContent>
                </Card>
              ) : (
                pendingDrafts.map((draft) => (
                  <DraftCard
                    key={draft.id}
                    draft={draft as Draft}
                    onApprove={() => handleApprove(draft.id)}
                    onHold={() => handleHold(draft.id)}
                    isApproving={selectedDraftId === draft.id && actionType === "approve"}
                    isHolding={selectedDraftId === draft.id && actionType === "hold"}
                  />
                ))
              )}
            </div>

            {/* Other Drafts */}
            {otherDrafts.length > 0 && (
              <div>
                <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-muted-foreground" />
                  History ({otherDrafts.length})
                </h2>
                {otherDrafts.map((draft) => (
                  <DraftCard
                    key={draft.id}
                    draft={draft as Draft}
                    onApprove={() => {}}
                    onHold={() => {}}
                    isApproving={false}
                    isHolding={false}
                  />
                ))}
              </div>
            )}
          </>
        )}

        {/* Result Dialog */}
        <Dialog open={showResultDialog} onOpenChange={setShowResultDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {resultMessage?.success ? (
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                ) : (
                  <XCircle className="h-5 w-5 text-red-500" />
                )}
                {resultMessage?.success ? "Success" : "Action Failed"}
              </DialogTitle>
              <DialogDescription>
                {resultMessage?.message}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button onClick={() => setShowResultDialog(false)}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
