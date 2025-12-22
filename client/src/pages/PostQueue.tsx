import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Send, 
  Calendar,
  Cloud,
  Trophy,
  Users,
  TrendingUp,
  AlertTriangle,
  ChevronRight,
  Edit3,
  Shield,
  Sparkles,
  ImagePlus
} from "lucide-react";


// Mock data for demonstration - will be replaced with real tRPC queries
const mockPosts = [
  {
    id: 1,
    content: "❄️ Winter weather advisory in effect! Our crews are ready to keep your driveways and walkways clear. Stay safe out there, Chicago!",
    headline: "Winter Weather Alert",
    postType: "ACTIVE_STORM",
    status: "needs_review",
    reasonChips: ["weather"],
    whyWeWroteThis: "NWS issued a winter weather advisory for the Chicago area. This is a high-relevance moment for snow removal services.",
    suggestedAlts: [
      "Snow's coming! We're ready to clear your path. Stay warm, Chicago! ❄️",
      "Winter advisory alert: Our team is standing by to keep you clear and safe."
    ],
    confidenceScore: 92,
    scheduledFor: new Date(Date.now() + 2 * 60 * 60 * 1000), // 2 hours from now
    weatherData: {
      condition: "Snow",
      temperature: 28,
      alerts: ["Winter Weather Advisory"],
      forecast: "3-5 inches expected"
    },
    createdAt: new Date(),
  },
  {
    id: 2,
    content: "Bears game day! 🏈 Need your driveway cleared before the big game? We've got you covered. Go Bears!",
    headline: "Game Day Ready",
    postType: "GAME_DAY",
    status: "needs_review",
    reasonChips: ["weather", "sports"],
    whyWeWroteThis: "Chicago Bears home game today + light snow in forecast. Perfect timing to remind customers about pre-game clearing.",
    suggestedAlts: [
      "Game day + snow day = we've got you covered! 🏈❄️ Go Bears!",
      "Don't let snow keep you from the game. We clear, you cheer!"
    ],
    confidenceScore: 85,
    scheduledFor: new Date(Date.now() + 4 * 60 * 60 * 1000),
    createdAt: new Date(),
  },
  {
    id: 3,
    content: "Beautiful clear day in Chicago! ☀️ Perfect weather to get outside. We're here if you need us!",
    headline: "All Clear",
    postType: "ALL_CLEAR",
    status: "approved",
    reasonChips: ["weather"],
    whyWeWroteThis: "Clear weather, no precipitation expected. Light engagement post to stay visible without being pushy.",
    suggestedAlts: [],
    confidenceScore: 78,
    scheduledFor: new Date(Date.now() + 24 * 60 * 60 * 1000),
    approvedAt: new Date(Date.now() - 60 * 60 * 1000),
    createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
  },
];

const statusConfig = {
  needs_review: { label: "Needs Review", color: "bg-amber-500/20 text-amber-400 border-amber-500/30", icon: Clock },
  approved: { label: "Approved", color: "bg-green-500/20 text-green-400 border-green-500/30", icon: CheckCircle2 },
  rejected: { label: "Rejected", color: "bg-red-500/20 text-red-400 border-red-500/30", icon: XCircle },
  published: { label: "Published", color: "bg-blue-500/20 text-blue-400 border-blue-500/30", icon: Send },
  expired: { label: "Expired", color: "bg-zinc-500/20 text-zinc-400 border-zinc-500/30", icon: AlertTriangle },
};

const postTypeConfig = {
  ALL_CLEAR: { label: "All Clear", color: "bg-emerald-500/20 text-emerald-400" },
  MONITORING: { label: "Monitoring", color: "bg-blue-500/20 text-blue-400" },
  ACTIVE_STORM: { label: "Active Storm", color: "bg-orange-500/20 text-orange-400" },
  WEATHER_UPDATE: { label: "Weather Update", color: "bg-sky-500/20 text-sky-400" },
  GAME_DAY: { label: "Game Day", color: "bg-purple-500/20 text-purple-400" },
  COMMUNITY_EVENT: { label: "Community", color: "bg-pink-500/20 text-pink-400" },
  LOCAL_TREND: { label: "Trending", color: "bg-rose-500/20 text-rose-400" },
  SEASONAL: { label: "Seasonal", color: "bg-teal-500/20 text-teal-400" },
  MANUAL: { label: "Manual", color: "bg-zinc-500/20 text-zinc-400" },
};

const reasonChipConfig = {
  weather: { label: "Weather", icon: Cloud, color: "bg-sky-500/20 text-sky-400" },
  sports: { label: "Sports", icon: Trophy, color: "bg-purple-500/20 text-purple-400" },
  community: { label: "Community", icon: Users, color: "bg-pink-500/20 text-pink-400" },
  trends: { label: "Trends", icon: TrendingUp, color: "bg-rose-500/20 text-rose-400" },
};

const safetyRules = [
  "No references to tragedies, accidents, or emergencies",
  "No political content or controversial topics",
  "No panic language or fear-mongering",
  "No competitor mentions or comparisons",
  "Respects quiet hours (10pm - 7am)",
];

export default function PostQueue() {
  
  const [selectedPost, setSelectedPost] = useState<typeof mockPosts[0] | null>(mockPosts[0]);
  const [editedContent, setEditedContent] = useState(selectedPost?.content || "");
  const [autoApproveType, setAutoApproveType] = useState(false);
  const [filter, setFilter] = useState<"all" | "needs_review" | "approved" | "published">("all");

  const filteredPosts = mockPosts.filter(post => {
    if (filter === "all") return true;
    return post.status === filter;
  });

  const handleSelectPost = (post: typeof mockPosts[0]) => {
    setSelectedPost(post);
    setEditedContent(post.content);
  };

  const handleApprove = (scheduleNow: boolean) => {
    alert(scheduleNow ? "Post Approved & Scheduled" : "Post Approved");
  };

  const handleReject = () => {
    alert("Post Rejected");
  };

  const formatScheduledTime = (date: Date) => {
    const now = new Date();
    const diff = date.getTime() - now.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 24) {
      return date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
    }
    if (hours > 0) {
      return `In ${hours}h ${minutes}m`;
    }
    return `In ${minutes}m`;
  };

  return (
    <div className="min-h-screen bg-[#0B0B0C]">
      {/* Header */}
      <div className="border-b border-zinc-800 bg-[#0B0B0C]/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-white">Post Approval Queue</h1>
              <p className="text-zinc-400 text-sm mt-1">Review and approve posts before they go live</p>
            </div>
            <div className="flex items-center gap-2">
              {["all", "needs_review", "approved", "published"].map((f) => (
                <Button
                  key={f}
                  variant={filter === f ? "default" : "outline"}
                  size="sm"
                  onClick={() => setFilter(f as typeof filter)}
                  className={filter === f ? "bg-[#FF6A00] hover:bg-[#FF6A00]/90" : "border-zinc-700 text-zinc-400 hover:text-white"}
                >
                  {f === "all" ? "All" : f === "needs_review" ? "Needs Review" : f.charAt(0).toUpperCase() + f.slice(1)}
                </Button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6">
        <div className="grid grid-cols-12 gap-6">
          {/* Left Panel - Queue List */}
          <div className="col-span-5 space-y-3">
            {filteredPosts.length === 0 ? (
              <Card className="bg-zinc-900/50 border-zinc-800">
                <CardContent className="py-12 text-center">
                  <CheckCircle2 className="w-12 h-12 text-zinc-600 mx-auto mb-4" />
                  <p className="text-zinc-400">No posts in queue</p>
                  <p className="text-zinc-500 text-sm mt-1">New posts will appear here when generated</p>
                </CardContent>
              </Card>
            ) : (
              filteredPosts.map((post) => {
                const StatusIcon = statusConfig[post.status as keyof typeof statusConfig]?.icon || Clock;
                const isSelected = selectedPost?.id === post.id;
                
                return (
                  <Card 
                    key={post.id}
                    className={`bg-zinc-900/50 border cursor-pointer transition-all hover:border-zinc-600 ${
                      isSelected ? "border-[#FF6A00] ring-1 ring-[#FF6A00]/20" : "border-zinc-800"
                    }`}
                    onClick={() => handleSelectPost(post)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          {/* Status + Post Type */}
                          <div className="flex items-center gap-2 mb-2">
                            <Badge className={`${statusConfig[post.status as keyof typeof statusConfig]?.color} border text-xs`}>
                              <StatusIcon className="w-3 h-3 mr-1" />
                              {statusConfig[post.status as keyof typeof statusConfig]?.label}
                            </Badge>
                            <Badge className={`${postTypeConfig[post.postType as keyof typeof postTypeConfig]?.color} text-xs`}>
                              {postTypeConfig[post.postType as keyof typeof postTypeConfig]?.label}
                            </Badge>
                          </div>
                          
                          {/* Reason Chips */}
                          <div className="flex items-center gap-1.5 mb-2">
                            {post.reasonChips?.map((chip) => {
                              const config = reasonChipConfig[chip as keyof typeof reasonChipConfig];
                              if (!config) return null;
                              const Icon = config.icon;
                              return (
                                <span key={chip} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs ${config.color}`}>
                                  <Icon className="w-3 h-3" />
                                  {config.label}
                                </span>
                              );
                            })}
                          </div>
                          
                          {/* Preview */}
                          <p className="text-zinc-300 text-sm line-clamp-2">{post.content}</p>
                          
                          {/* Scheduled Time */}
                          {post.scheduledFor && (
                            <div className="flex items-center gap-1.5 mt-2 text-xs text-zinc-500">
                              <Calendar className="w-3 h-3" />
                              {formatScheduledTime(post.scheduledFor)}
                            </div>
                          )}
                        </div>
                        
                        <ChevronRight className={`w-5 h-5 text-zinc-600 flex-shrink-0 transition-colors ${isSelected ? "text-[#FF6A00]" : ""}`} />
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>

          {/* Right Panel - Review */}
          <div className="col-span-7">
            {selectedPost ? (
              <div className="space-y-4">
                {/* Post Content Card */}
                <Card className="bg-zinc-900/50 border-zinc-800">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg text-white flex items-center gap-2">
                        <Edit3 className="w-5 h-5 text-[#FF6A00]" />
                        Edit Post
                      </CardTitle>
                      <Badge className={`${postTypeConfig[selectedPost.postType as keyof typeof postTypeConfig]?.color}`}>
                        {postTypeConfig[selectedPost.postType as keyof typeof postTypeConfig]?.label}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <Textarea
                      value={editedContent}
                      onChange={(e) => setEditedContent(e.target.value)}
                      className="min-h-[120px] bg-zinc-800/50 border-zinc-700 text-white resize-none"
                      placeholder="Post content..."
                    />
                    
                    {/* Character count */}
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-zinc-500">{editedContent.length} characters</span>
                      <Button variant="ghost" size="sm" className="text-zinc-400 hover:text-white h-7">
                        <ImagePlus className="w-4 h-4 mr-1" />
                        Add Image
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                {/* Suggested Alternatives */}
                {selectedPost.suggestedAlts && selectedPost.suggestedAlts.length > 0 && (
                  <Card className="bg-zinc-900/50 border-zinc-800">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm text-zinc-400 flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-[#FF6A00]" />
                        Alternative Versions
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {selectedPost.suggestedAlts.map((alt, i) => (
                        <button
                          key={i}
                          onClick={() => setEditedContent(alt)}
                          className="w-full text-left p-3 rounded-lg bg-zinc-800/30 hover:bg-zinc-800/50 border border-zinc-700/50 hover:border-zinc-600 transition-colors"
                        >
                          <p className="text-zinc-300 text-sm">{alt}</p>
                        </button>
                      ))}
                    </CardContent>
                  </Card>
                )}

                {/* Why We Wrote This */}
                {selectedPost.whyWeWroteThis && (
                  <Card className="bg-zinc-900/50 border-zinc-800">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm text-zinc-400">Why We Wrote This</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-zinc-300 text-sm">{selectedPost.whyWeWroteThis}</p>
                      
                      {/* Weather Data */}
                      {selectedPost.weatherData && (
                        <div className="mt-3 p-3 rounded-lg bg-sky-500/10 border border-sky-500/20">
                          <div className="flex items-center gap-2 text-sky-400 text-sm">
                            <Cloud className="w-4 h-4" />
                            <span className="font-medium">Weather Context</span>
                          </div>
                          <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-zinc-400">
                            <div>Condition: <span className="text-zinc-300">{selectedPost.weatherData.condition}</span></div>
                            <div>Temp: <span className="text-zinc-300">{selectedPost.weatherData.temperature}°F</span></div>
                            {selectedPost.weatherData.forecast && (
                              <div className="col-span-2">Forecast: <span className="text-zinc-300">{selectedPost.weatherData.forecast}</span></div>
                            )}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}

                {/* Safety Gates */}
                <Card className="bg-zinc-900/50 border-zinc-800">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-zinc-400 flex items-center gap-2">
                      <Shield className="w-4 h-4 text-green-400" />
                      Safety Gates Passed
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 gap-1.5">
                      {safetyRules.map((rule, i) => (
                        <div key={i} className="flex items-center gap-2 text-xs text-zinc-400">
                          <CheckCircle2 className="w-3.5 h-3.5 text-green-400 flex-shrink-0" />
                          {rule}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Auto-approve toggle */}
                <div className="flex items-center justify-between p-4 rounded-lg bg-zinc-900/50 border border-zinc-800">
                  <div>
                    <Label className="text-sm text-white">Auto-approve this post type</Label>
                    <p className="text-xs text-zinc-500 mt-0.5">Future "{postTypeConfig[selectedPost.postType as keyof typeof postTypeConfig]?.label}" posts will be approved automatically</p>
                  </div>
                  <Switch
                    checked={autoApproveType}
                    onCheckedChange={setAutoApproveType}
                  />
                </div>

                <Separator className="bg-zinc-800" />

                {/* Action Buttons */}
                <div className="flex items-center gap-3">
                  <Button
                    onClick={() => handleApprove(true)}
                    className="flex-1 bg-[#FF6A00] hover:bg-[#FF6A00]/90 text-white"
                  >
                    <Send className="w-4 h-4 mr-2" />
                    Approve & Schedule
                  </Button>
                  <Button
                    onClick={() => handleApprove(false)}
                    variant="outline"
                    className="border-zinc-700 text-white hover:bg-zinc-800"
                  >
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                    Approve
                  </Button>
                  <Button
                    onClick={handleReject}
                    variant="outline"
                    className="border-red-500/30 text-red-400 hover:bg-red-500/10 hover:text-red-300"
                  >
                    <XCircle className="w-4 h-4 mr-2" />
                    Reject
                  </Button>
                </div>

                {/* Scheduled time note */}
                {selectedPost.scheduledFor && (
                  <p className="text-xs text-zinc-500 text-center">
                    Scheduled for {selectedPost.scheduledFor.toLocaleString("en-US", { 
                      weekday: "long", 
                      month: "short", 
                      day: "numeric", 
                      hour: "numeric", 
                      minute: "2-digit" 
                    })}
                  </p>
                )}
              </div>
            ) : (
              <Card className="bg-zinc-900/50 border-zinc-800 h-full flex items-center justify-center">
                <CardContent className="text-center py-12">
                  <Edit3 className="w-12 h-12 text-zinc-600 mx-auto mb-4" />
                  <p className="text-zinc-400">Select a post to review</p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
