import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Check, Link2, Settings2 } from "lucide-react";

// Demo integrations
const integrations = [
  {
    id: "salesforce",
    name: "Salesforce",
    description: "Sync call data to Salesforce CRM automatically",
    category: "CRM",
    connected: true,
    logo: "🔷",
  },
  {
    id: "hubspot",
    name: "HubSpot",
    description: "Create contacts and log calls in HubSpot",
    category: "CRM",
    connected: false,
    logo: "🟠",
  },
  {
    id: "slack",
    name: "Slack",
    description: "Get notifications for important calls in Slack",
    category: "Communication",
    connected: true,
    logo: "💬",
  },
  {
    id: "google-calendar",
    name: "Google Calendar",
    description: "Schedule callbacks and follow-ups automatically",
    category: "Productivity",
    connected: false,
    logo: "📅",
  },
  {
    id: "zapier",
    name: "Zapier",
    description: "Connect to 5,000+ apps via Zapier",
    category: "Automation",
    connected: true,
    logo: "⚡",
  },
  {
    id: "google-analytics",
    name: "Google Analytics",
    description: "Track widget performance and conversions",
    category: "Analytics",
    connected: false,
    logo: "📊",
  },
];

const webhooks = [
  { event: "call.started", url: "https://api.example.com/webhooks/call-started", active: true },
  { event: "call.completed", url: "https://api.example.com/webhooks/call-completed", active: true },
  { event: "call.escalated", url: "https://api.example.com/webhooks/escalation", active: false },
];

export default function Integrations() {
  const [apiKey] = useState("sk_live_abc123...xyz789");
  const [showApiKey, setShowApiKey] = useState(false);

  const handleToggleIntegration = (id: string, currentState: boolean) => {
    if (currentState) {
      toast.success(`Disconnected from ${integrations.find(i => i.id === id)?.name}`);
    } else {
      toast.success(`Connected to ${integrations.find(i => i.id === id)?.name}`);
    }
  };

  const handleCopyApiKey = () => {
    navigator.clipboard.writeText(apiKey);
    toast.success("API key copied to clipboard");
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Integrations</h1>
        <p className="text-muted-foreground mt-2">
          Connect your AI assistant to other tools and services
        </p>
      </div>

      {/* API Configuration */}
      <Card>
        <CardHeader>
          <CardTitle>API Configuration</CardTitle>
          <CardDescription>
            Use these credentials to integrate with your custom applications
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>API Key</Label>
            <div className="flex gap-2">
              <Input
                type={showApiKey ? "text" : "password"}
                value={apiKey}
                readOnly
                className="font-mono"
              />
              <Button variant="outline" onClick={() => setShowApiKey(!showApiKey)}>
                {showApiKey ? "Hide" : "Show"}
              </Button>
              <Button variant="outline" onClick={handleCopyApiKey}>
                Copy
              </Button>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Webhook URL</Label>
            <Input
              value="https://api.klariqo.com/v1/webhooks"
              readOnly
              className="font-mono"
            />
          </div>
        </CardContent>
      </Card>

      {/* Available Integrations */}
      <Card>
        <CardHeader>
          <CardTitle>Available Integrations</CardTitle>
          <CardDescription>
            Connect to popular business tools
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {integrations.map((integration) => (
              <div
                key={integration.id}
                className="p-4 border rounded-lg flex items-start justify-between"
              >
                <div className="flex gap-3">
                  <div className="text-3xl">{integration.logo}</div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-semibold">{integration.name}</h4>
                      {integration.connected && (
                        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                          <Check className="mr-1 h-3 w-3" />
                          Connected
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      {integration.description}
                    </p>
                    <Badge variant="secondary" className="mt-2 text-xs">
                      {integration.category}
                    </Badge>
                  </div>
                </div>
                <Button
                  variant={integration.connected ? "outline" : "default"}
                  size="sm"
                  onClick={() => handleToggleIntegration(integration.id, integration.connected)}
                >
                  <Link2 className="mr-2 h-4 w-4" />
                  {integration.connected ? "Disconnect" : "Connect"}
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Webhooks */}
      <Card>
        <CardHeader>
          <CardTitle>Webhooks</CardTitle>
          <CardDescription>
            Receive real-time notifications about events
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {webhooks.map((webhook, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between p-4 border rounded-lg"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{webhook.event}</Badge>
                    {webhook.active && (
                      <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                        Active
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground mt-1 font-mono">
                    {webhook.url}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={webhook.active} />
                  <Button variant="ghost" size="sm">
                    <Settings2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
          <Button variant="outline" className="w-full mt-4">
            + Add Webhook
          </Button>
        </CardContent>
      </Card>

      {/* Documentation */}
      <Card>
        <CardHeader>
          <CardTitle>Developer Resources</CardTitle>
          <CardDescription>
            Documentation and guides for building integrations
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Button variant="link" className="p-0 h-auto">
              📚 API Documentation
            </Button>
            <Button variant="link" className="p-0 h-auto">
              🔧 Webhook Guide
            </Button>
            <Button variant="link" className="p-0 h-auto">
              💡 Integration Examples
            </Button>
            <Button variant="link" className="p-0 h-auto">
              🆘 Support & Help
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
