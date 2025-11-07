import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Phone, Clock, MessageSquare, TrendingUp, Edit } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function DashboardHome() {
  const [callsData, setCallsData] = useState<any[]>([]);
  const [stats, setStats] = useState({
    totalCalls: 0,
    avgDuration: 0,
    topTopics: [] as string[],
    sentimentBreakdown: { positive: 0, neutral: 0, negative: 0 },
    activePhones: 0,
  });
  const [activePrompt, setActivePrompt] = useState<any>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      // Fetch calls from the last week
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);

      const { data: calls, error: callsError } = await supabase
        .from("calls")
        .select("*")
        .gte("created_at", weekAgo.toISOString());

      if (callsError) throw callsError;

      // Fetch active phone numbers
      const { data: phones, error: phonesError } = await supabase
        .from("phone_numbers")
        .select("*")
        .eq("status", "active");

      if (phonesError) throw phonesError;

      // Fetch active AI config
      const { data: config, error: configError } = await supabase
        .from("ai_config")
        .select("*")
        .eq("is_active", true)
        .maybeSingle();

      if (configError) throw configError;

      // Process data for stats
      const totalCalls = calls?.length || 0;
      const avgDuration = calls?.reduce((acc, call) => acc + (call.duration || 0), 0) / totalCalls || 0;
      
      // Get top topics
      const topicsMap: Record<string, number> = {};
      calls?.forEach(call => {
        call.topics?.forEach((topic: string) => {
          topicsMap[topic] = (topicsMap[topic] || 0) + 1;
        });
      });
      const topTopics = Object.entries(topicsMap)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([topic]) => topic);

      // Calculate sentiment breakdown
      const sentimentBreakdown = {
        positive: calls?.filter(c => c.sentiment === 'positive').length || 0,
        neutral: calls?.filter(c => c.sentiment === 'neutral').length || 0,
        negative: calls?.filter(c => c.sentiment === 'negative').length || 0,
      };

      // Group calls by day for chart
      const callsByDay: Record<string, number> = {};
      calls?.forEach(call => {
        const date = new Date(call.created_at).toLocaleDateString();
        callsByDay[date] = (callsByDay[date] || 0) + 1;
      });

      const chartData = Object.entries(callsByDay).map(([date, count]) => ({
        date,
        calls: count,
      }));

      setCallsData(chartData);
      setStats({
        totalCalls,
        avgDuration: Math.round(avgDuration),
        topTopics,
        sentimentBreakdown,
        activePhones: phones?.length || 0,
      });
      setActivePrompt(config);
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
      toast({
        title: "Error",
        description: "Failed to load dashboard data",
        variant: "destructive",
      });
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">Quick snapshot of your voice AI assistant</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Calls (Week)</CardTitle>
            <Phone className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalCalls}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Avg Call Duration</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatDuration(stats.avgDuration)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Active Phone Numbers</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.activePhones}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Positive Sentiment</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats.totalCalls > 0
                ? Math.round((stats.sentimentBreakdown.positive / stats.totalCalls) * 100)
                : 0}%
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Calls Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Calls This Week</CardTitle>
          <CardDescription>Daily call volume</CardDescription>
        </CardHeader>
        <CardContent className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={callsData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="calls" fill="hsl(var(--primary))" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Bottom Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Topics */}
        <Card>
          <CardHeader>
            <CardTitle>Top Call Topics</CardTitle>
            <CardDescription>Most discussed topics from AI analysis</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {stats.topTopics.length > 0 ? (
                stats.topTopics.map((topic, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                    <span className="font-medium">{topic}</span>
                  </div>
                ))
              ) : (
                <p className="text-muted-foreground">No topics data available</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Sentiment Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle>Sentiment Breakdown</CardTitle>
            <CardDescription>Call sentiment analysis</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">Positive</span>
                  <span className="text-sm text-muted-foreground">
                    {stats.sentimentBreakdown.positive} calls
                  </span>
                </div>
                <div className="w-full bg-muted rounded-full h-2">
                  <div
                    className="bg-green-500 h-2 rounded-full"
                    style={{
                      width: `${stats.totalCalls > 0 ? (stats.sentimentBreakdown.positive / stats.totalCalls) * 100 : 0}%`,
                    }}
                  />
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">Neutral</span>
                  <span className="text-sm text-muted-foreground">
                    {stats.sentimentBreakdown.neutral} calls
                  </span>
                </div>
                <div className="w-full bg-muted rounded-full h-2">
                  <div
                    className="bg-yellow-500 h-2 rounded-full"
                    style={{
                      width: `${stats.totalCalls > 0 ? (stats.sentimentBreakdown.neutral / stats.totalCalls) * 100 : 0}%`,
                    }}
                  />
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">Negative</span>
                  <span className="text-sm text-muted-foreground">
                    {stats.sentimentBreakdown.negative} calls
                  </span>
                </div>
                <div className="w-full bg-muted rounded-full h-2">
                  <div
                    className="bg-red-500 h-2 rounded-full"
                    style={{
                      width: `${stats.totalCalls > 0 ? (stats.sentimentBreakdown.negative / stats.totalCalls) * 100 : 0}%`,
                    }}
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* AI Prompt Config */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Current AI Prompt Configuration</CardTitle>
            <CardDescription>Active AI assistant configuration</CardDescription>
          </CardHeader>
          <CardContent>
            {activePrompt ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Version: {activePrompt.prompt_version}</p>
                    <p className="text-sm text-muted-foreground">
                      Created: {new Date(activePrompt.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <Button variant="outline" size="sm">
                    <Edit className="h-4 w-4 mr-2" />
                    Edit
                  </Button>
                </div>
                <div className="p-4 bg-muted rounded-lg">
                  <p className="text-sm whitespace-pre-wrap">{activePrompt.system_prompt}</p>
                </div>
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-muted-foreground mb-4">No active prompt configuration</p>
                <Button>Create Configuration</Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
