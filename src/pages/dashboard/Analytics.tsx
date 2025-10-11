import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BarChart, LineChart, PieChart } from "lucide-react";

// Demo data for MVP
const demoStats = {
  totalCalls: 1247,
  avgDuration: "3m 24s",
  resolutionRate: "87%",
  customerSatisfaction: "4.6/5",
};

const callVolumeData = [
  { day: "Mon", calls: 42 },
  { day: "Tue", calls: 56 },
  { day: "Wed", calls: 48 },
  { day: "Thu", calls: 63 },
  { day: "Fri", calls: 71 },
  { day: "Sat", calls: 38 },
  { day: "Sun", calls: 29 },
];

const sentimentData = [
  { label: "Positive", value: 62, color: "bg-green-500" },
  { label: "Neutral", value: 28, color: "bg-blue-500" },
  { label: "Negative", value: 10, color: "bg-red-500" },
];

const topTopics = [
  { topic: "Pricing Questions", count: 284 },
  { topic: "Product Features", count: 203 },
  { topic: "Technical Support", count: 156 },
  { topic: "Account Issues", count: 127 },
  { topic: "Billing Inquiries", count: 98 },
];

const outcomeStats = [
  { outcome: "Resolved", count: 1085, percentage: 87 },
  { outcome: "Escalated", count: 124, percentage: 10 },
  { outcome: "Callback Scheduled", count: 38, percentage: 3 },
];

export default function Analytics() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Analytics Dashboard</h1>
        <p className="text-muted-foreground mt-2">
          Insights and performance metrics for your AI voice assistant
        </p>
      </div>

      {/* Key metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Total Calls</CardDescription>
            <CardTitle className="text-3xl">{demoStats.totalCalls}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              <span className="text-green-500">↑ 12%</span> from last month
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Avg Call Duration</CardDescription>
            <CardTitle className="text-3xl">{demoStats.avgDuration}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              <span className="text-green-500">↓ 8%</span> improvement
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Resolution Rate</CardDescription>
            <CardTitle className="text-3xl">{demoStats.resolutionRate}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              <span className="text-green-500">↑ 5%</span> from last month
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Customer Satisfaction</CardDescription>
            <CardTitle className="text-3xl">{demoStats.customerSatisfaction}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              Based on 324 surveys
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Call volume chart */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <BarChart className="h-5 w-5 text-primary" />
              <CardTitle>Call Volume (Last 7 Days)</CardTitle>
            </div>
            <CardDescription>Daily call distribution</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {callVolumeData.map((item) => (
                <div key={item.day} className="flex items-center gap-4">
                  <span className="w-12 text-sm font-medium">{item.day}</span>
                  <div className="flex-1 bg-muted rounded-full h-8 overflow-hidden">
                    <div
                      className="bg-primary h-full flex items-center justify-end pr-2"
                      style={{ width: `${(item.calls / 80) * 100}%` }}
                    >
                      <span className="text-xs font-medium text-primary-foreground">
                        {item.calls}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Sentiment distribution */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <PieChart className="h-5 w-5 text-primary" />
              <CardTitle>Sentiment Distribution</CardTitle>
            </div>
            <CardDescription>Customer sentiment analysis</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              <div className="flex gap-2 h-12 rounded-lg overflow-hidden">
                {sentimentData.map((item) => (
                  <div
                    key={item.label}
                    className={`${item.color} flex items-center justify-center text-white text-sm font-medium`}
                    style={{ width: `${item.value}%` }}
                  >
                    {item.value}%
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-3 gap-4">
                {sentimentData.map((item) => (
                  <div key={item.label} className="flex items-center gap-2">
                    <div className={`w-3 h-3 rounded-full ${item.color}`} />
                    <span className="text-sm text-muted-foreground">
                      {item.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Top topics */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <LineChart className="h-5 w-5 text-primary" />
              <CardTitle>Top Discussion Topics</CardTitle>
            </div>
            <CardDescription>Most common customer inquiries</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {topTopics.map((item, idx) => (
                <div key={item.topic} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Badge variant="outline" className="w-8 justify-center">
                      {idx + 1}
                    </Badge>
                    <span className="text-sm font-medium">{item.topic}</span>
                  </div>
                  <span className="text-sm text-muted-foreground">
                    {item.count} calls
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Call outcomes */}
        <Card>
          <CardHeader>
            <CardTitle>Call Outcomes</CardTitle>
            <CardDescription>How calls are being resolved</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {outcomeStats.map((item) => (
                <div key={item.outcome} className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">{item.outcome}</span>
                    <span className="text-muted-foreground">
                      {item.count} ({item.percentage}%)
                    </span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary"
                      style={{ width: `${item.percentage}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Performance insights */}
      <Card>
        <CardHeader>
          <CardTitle>AI Performance Insights</CardTitle>
          <CardDescription>Key observations from recent calls</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="p-4 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-900 rounded-lg">
              <h4 className="font-semibold text-green-900 dark:text-green-100 mb-1">
                Strong Performance
              </h4>
              <p className="text-sm text-green-700 dark:text-green-300">
                AI successfully handled 87% of pricing questions without escalation,
                up from 79% last month.
              </p>
            </div>
            <div className="p-4 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900 rounded-lg">
              <h4 className="font-semibold text-blue-900 dark:text-blue-100 mb-1">
                Improvement Area
              </h4>
              <p className="text-sm text-blue-700 dark:text-blue-300">
                Technical support questions have a higher escalation rate (32%).
                Consider expanding the knowledge base.
              </p>
            </div>
            <div className="p-4 bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-900 rounded-lg">
              <h4 className="font-semibold text-yellow-900 dark:text-yellow-100 mb-1">
                Trending Topic
              </h4>
              <p className="text-sm text-yellow-700 dark:text-yellow-300">
                "Account Issues" calls increased 23% this week. May need prompt
                adjustment for better handling.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
