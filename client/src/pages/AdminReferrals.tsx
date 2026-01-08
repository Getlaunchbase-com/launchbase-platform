import { useState } from "react";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Gift, 
  Users, 
  DollarSign, 
  Clock, 
  CheckCircle,
  Copy,
  Loader2
} from "lucide-react";
import { toast } from "sonner";

export default function AdminReferrals() {
  const { data: referrals, isLoading } = trpc.admin.referrals.list.useQuery();
  const { data: stats } = trpc.admin.referrals.stats.useQuery();
  const utils = trpc.useUtils();
  
  const markPaid = trpc.admin.referrals.markPaid.useMutation({
    onSuccess: () => {
      utils.admin.referrals.list.invalidate();
      utils.admin.referrals.stats.invalidate();
      toast.success("Marked as paid");
    },
  });

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success("Code copied");
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold">Referrals</h1>
          <p className="text-muted-foreground">Track referral codes and conversions</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                  <Gift className="h-5 w-5 text-blue-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Codes</p>
                  <p className="text-2xl font-bold">{stats?.total || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-yellow-500/10 flex items-center justify-center">
                  <Clock className="h-5 w-5 text-yellow-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Pending</p>
                  <p className="text-2xl font-bold">{stats?.pending || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                  <Users className="h-5 w-5 text-green-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Converted</p>
                  <p className="text-2xl font-bold">{stats?.used || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-orange-500/10 flex items-center justify-center">
                  <DollarSign className="h-5 w-5 text-orange-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Payouts</p>
                  <p className="text-2xl font-bold">${stats?.totalEarnings || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Referrals Table */}
        <Card>
          <CardHeader>
            <CardTitle>All Referral Codes</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : !referrals?.length ? (
              <div className="text-center py-8 text-muted-foreground">
                <Gift className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>No referral codes yet</p>
                <p className="text-sm">Codes are generated when customers complete payment</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground">Code</th>
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground">Referrer Email</th>
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground">Status</th>
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground">Reward</th>
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground">Created</th>
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {referrals.map((referral) => (
                      <tr key={referral.id} className="border-b border-border/50 hover:bg-muted/30">
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <code className="bg-muted px-2 py-1 rounded text-sm font-mono">
                              {referral.code}
                            </code>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => copyCode(referral.code)}
                            >
                              <Copy className="h-3 w-3" />
                            </Button>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-sm">{referral.referrerEmail}</td>
                        <td className="py-3 px-4">
                          <Badge variant={referral.status === "used" ? "default" : "secondary"}>
                            {referral.status === "used" ? "Converted" : "Pending"}
                          </Badge>
                        </td>
                        <td className="py-3 px-4">
                          {referral.status === "used" ? (
                            referral.referrerRewardApplied ? (
                              <Badge variant="outline" className="text-green-500 border-green-500/30">
                                <CheckCircle className="h-3 w-3 mr-1" />
                                Paid
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-yellow-500 border-yellow-500/30">
                                $50 owed
                              </Badge>
                            )
                          ) : (
                            <span className="text-muted-foreground text-sm">—</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-sm text-muted-foreground">
                          {new Date(referral.createdAt).toLocaleDateString()}
                        </td>
                        <td className="py-3 px-4">
                          {referral.status === "used" && !referral.referrerRewardApplied && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => markPaid.mutate({ id: referral.id })}
                              disabled={markPaid.isPending}
                            >
                              {markPaid.isPending ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                "Mark Paid"
                              )}
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
