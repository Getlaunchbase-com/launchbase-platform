import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Rocket, 
  CheckCircle, 
  XCircle,
  AlertCircle,
  Send,
  Clock
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useParams } from "wouter";

export default function Clarify() {
  const params = useParams<{ token: string }>();
  const token = params.token || "";
  const [answer, setAnswer] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const { data: clarification, isLoading, error } = trpc.clarify.get.useQuery(
    { token },
    { enabled: !!token }
  );

  const submitMutation = trpc.clarify.submit.useMutation({
    onSuccess: (result) => {
      if (result.success) {
        setSubmitted(true);
      }
    },
  });

  const handleSubmit = () => {
    if (answer.trim()) {
      submitMutation.mutate({ token, answer: answer.trim() });
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0B0B0C] text-white flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-[#FF6A00] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  // Error or not found
  if (error || !clarification) {
    return (
      <div className="min-h-screen bg-[#0B0B0C] text-white flex items-center justify-center px-4">
        <Card className="max-w-md w-full bg-white/5 border-white/10">
          <CardContent className="py-12 text-center">
            <XCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
            <h1 className="text-2xl font-bold mb-2">Link Not Found</h1>
            <p className="text-gray-400">
              This clarification link doesn't exist or has expired.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Already used
  if (clarification.used || clarification.status === "answered") {
    return (
      <div className="min-h-screen bg-[#0B0B0C] text-white flex items-center justify-center px-4">
        <Card className="max-w-md w-full bg-white/5 border-white/10">
          <CardContent className="py-12 text-center">
            <CheckCircle className="w-16 h-16 text-[#1ED760] mx-auto mb-4" />
            <h1 className="text-2xl font-bold mb-2">Already Submitted</h1>
            <p className="text-gray-400">
              This clarification has already been answered. Thank you!
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Expired
  if (clarification.expiresAt && new Date(clarification.expiresAt) < new Date()) {
    return (
      <div className="min-h-screen bg-[#0B0B0C] text-white flex items-center justify-center px-4">
        <Card className="max-w-md w-full bg-white/5 border-white/10">
          <CardContent className="py-12 text-center">
            <Clock className="w-16 h-16 text-yellow-400 mx-auto mb-4" />
            <h1 className="text-2xl font-bold mb-2">Link Expired</h1>
            <p className="text-gray-400">
              This clarification link has expired. Please contact us for a new link.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Submitted success
  if (submitted) {
    return (
      <div className="min-h-screen bg-[#0B0B0C] text-white flex items-center justify-center px-4">
        <Card className="max-w-md w-full bg-white/5 border-white/10">
          <CardContent className="py-12 text-center">
            <CheckCircle className="w-16 h-16 text-[#1ED760] mx-auto mb-4" />
            <h1 className="text-2xl font-bold mb-2">Thank You!</h1>
            <p className="text-gray-400">
              Your response has been submitted. We'll continue building your site.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Main form
  return (
    <div className="min-h-screen bg-[#0B0B0C] text-white">
      {/* Header */}
      <header className="border-b border-white/10">
        <div className="container max-w-2xl mx-auto px-4 py-4 flex items-center gap-2">
          <div className="w-8 h-8 bg-[#FF6A00] rounded-lg flex items-center justify-center">
            <Rocket className="w-5 h-5 text-white" />
          </div>
          <span className="text-xl font-bold tracking-tight">LAUNCHBASE</span>
        </div>
      </header>

      {/* Main Content */}
      <main className="container max-w-2xl mx-auto px-4 py-12">
        <Card className="bg-white/5 border-white/10">
          <CardHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-[#FF6A00]/20 rounded-lg flex items-center justify-center">
                <AlertCircle className="w-5 h-5 text-[#FF6A00]" />
              </div>
              <CardTitle>We Need a Quick Clarification</CardTitle>
            </div>
            <p className="text-gray-400">
              To continue building your website, we need a bit more information.
            </p>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Question */}
            <div className="bg-white/5 rounded-lg p-4 border border-white/10">
              <p className="font-medium">{clarification.questionText}</p>
            </div>

            {/* Answer Input */}
            <div>
              <label className="text-sm text-gray-400 mb-2 block">Your Answer</label>
              {clarification.inputType === "text" ? (
                <Textarea
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value)}
                  placeholder="Type your answer here..."
                  className="min-h-32"
                />
              ) : (
                <Input
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value)}
                  placeholder="Type your answer here..."
                />
              )}
            </div>

            {/* Submit Button */}
            <Button
              onClick={handleSubmit}
              disabled={!answer.trim() || submitMutation.isPending}
              className="w-full bg-[#FF6A00] hover:bg-[#FF6A00]/90"
            >
              {submitMutation.isPending ? (
                "Submitting..."
              ) : (
                <>
                  <Send className="w-4 h-4 mr-2" />
                  Submit Answer
                </>
              )}
            </Button>

            {submitMutation.error && (
              <p className="text-red-400 text-sm text-center">
                {submitMutation.error.message}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Note */}
        <p className="text-center text-gray-500 text-sm mt-6">
          This is a one-time link. Once you submit, you won't be able to change your answer.
        </p>
      </main>
    </div>
  );
}
