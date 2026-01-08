import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, XCircle, Mail, AlertTriangle } from "lucide-react";

export function AdminEmailMonitoring() {
  const { data: emailStats, isLoading, refetch } = trpc.system.getEmailStats.useQuery();
  const sendTestEmail = trpc.system.sendTestEmail.useMutation();

  const [testEmail, setTestEmail] = useState("");
  const [testEmailType, setTestEmailType] = useState<"intake_confirmation" | "ready_for_review" | "site_live">("intake_confirmation");

  const handleSendTest = async () => {
    if (!testEmail) {
      toast.error("Please enter an email address");
      return;
    }

    try {
      const result = await sendTestEmail.mutateAsync({
        recipientEmail: testEmail,
        emailType: testEmailType,
      });

      if (result.success) {
        toast.success(`Test email sent via ${result.provider}`);
        refetch();
      } else {
        toast.error(`Failed to send: ${result.error || "Unknown error"}`);
      }
    } catch (error) {
      toast.error("Failed to send test email");
    }
  };

  if (isLoading) {
    return (
      <div className="container py-8">
        <h1 className="text-3xl font-bold mb-6">Email Monitoring</h1>
        <p className="text-muted-foreground">Loading email stats...</p>
      </div>
    );
  }

  const { recentEmails = [], stats } = emailStats || {};

  return (
    <div className="container py-8">
      <h1 className="text-3xl font-bold mb-6">Email Monitoring</h1>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Sent (24h)</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.sent || 0}</div>
            <p className="text-xs text-muted-foreground">Successfully delivered</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Failed (24h)</CardTitle>
            <XCircle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.failed || 0}</div>
            <p className="text-xs text-muted-foreground">Delivery failures</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Top Error</CardTitle>
            <AlertTriangle className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-sm font-mono truncate">{stats?.topError || "None"}</div>
            <p className="text-xs text-muted-foreground">Most common failure</p>
          </CardContent>
        </Card>
      </div>

      {/* Test Email Sender */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Send Test Email</CardTitle>
          <CardDescription>
            Verify Resend configuration by sending a test email to any inbox
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="test-email">Recipient Email</Label>
              <Input
                id="test-email"
                type="email"
                placeholder="test@example.com"
                value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)}
              />
            </div>

            <div>
              <Label htmlFor="test-email-type">Email Type</Label>
              <Select value={testEmailType} onValueChange={(v: any) => setTestEmailType(v)}>
                <SelectTrigger id="test-email-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="intake_confirmation">Intake Confirmation</SelectItem>
                  <SelectItem value="ready_for_review">Ready for Review</SelectItem>
                  <SelectItem value="site_live">Site Live</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-end">
              <Button
                onClick={handleSendTest}
                disabled={sendTestEmail.isPending}
                className="w-full"
              >
                <Mail className="mr-2 h-4 w-4" />
                {sendTestEmail.isPending ? "Sending..." : "Send Test"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Recent Emails Table */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Emails (Last 50)</CardTitle>
          <CardDescription>Email delivery log from the past 24 hours</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-2">Time</th>
                  <th className="text-left p-2">Type</th>
                  <th className="text-left p-2">Recipient</th>
                  <th className="text-left p-2">Status</th>
                  <th className="text-left p-2">Provider</th>
                  <th className="text-left p-2">Error</th>
                </tr>
              </thead>
              <tbody>
                {recentEmails.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center p-8 text-muted-foreground">
                      No emails sent in the last 24 hours
                    </td>
                  </tr>
                ) : (
                  recentEmails.map((email) => (
                    <tr key={email.id} className="border-b hover:bg-muted/50">
                      <td className="p-2 text-muted-foreground">
                        {new Date(email.sentAt).toLocaleString()}
                      </td>
                      <td className="p-2 font-mono text-xs">{email.emailType}</td>
                      <td className="p-2">{email.recipientEmail}</td>
                      <td className="p-2">
                        {email.status === "sent" ? (
                          <Badge variant="default" className="bg-green-600">
                            Sent
                          </Badge>
                        ) : (
                          <Badge variant="destructive">Failed</Badge>
                        )}
                      </td>
                      <td className="p-2">
                        <Badge variant="outline">{email.deliveryProvider}</Badge>
                      </td>
                      <td className="p-2 text-xs text-muted-foreground truncate max-w-xs">
                        {email.errorMessage || "—"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
