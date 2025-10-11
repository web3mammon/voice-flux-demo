import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Copy, Upload, MessageSquare, Sparkles, Phone } from "lucide-react";
import { Loader2 } from "lucide-react";
import { WidgetPreview } from "@/components/WidgetPreview";

const PRESET_ICONS = [
  { name: "Message", icon: MessageSquare },
  { name: "Sparkles", icon: Sparkles },
  { name: "Phone", icon: Phone },
];

export default function Widgets() {
  const { isAdmin, loading: roleLoading } = useUserRole();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState<any>(null);
  const [iconFile, setIconFile] = useState<File | null>(null);
  const [urlInput, setUrlInput] = useState("");

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    try {
      const { data, error } = await supabase
        .from("widget_config")
        .select("*")
        .eq("is_active", true)
        .maybeSingle();

      if (error) throw error;

      if (!data && isAdmin) {
        // Create default config for admin
        const { data: newConfig, error: createError } = await supabase
          .from("widget_config")
          .insert({
            position: "bottom-right",
            primary_color: "#6366f1",
            button_text: "Talk to Sales",
            trigger_type: "immediately",
            display_mode: "all_pages",
            hide_on_mobile: false,
          })
          .select()
          .single();

        if (createError) throw createError;
        setConfig(newConfig);
      } else {
        setConfig(data);
      }
    } catch (error) {
      console.error("Error fetching config:", error);
      toast.error("Failed to load widget configuration");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!isAdmin) return;
    setSaving(true);

    try {
      let iconUrl = config?.button_icon_url;

      // Upload icon if file is selected
      if (iconFile) {
        const fileExt = iconFile.name.split(".").pop();
        const fileName = `${Math.random()}.${fileExt}`;
        const { error: uploadError } = await supabase.storage
          .from("widget-icons")
          .upload(fileName, iconFile);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from("widget-icons")
          .getPublicUrl(fileName);

        iconUrl = publicUrl;
      }

      const { error } = await supabase
        .from("widget_config")
        .update({
          ...config,
          button_icon_url: iconUrl,
          updated_at: new Date().toISOString(),
        })
        .eq("id", config.id);

      if (error) throw error;

      toast.success("Widget configuration saved");
      fetchConfig();
    } catch (error) {
      console.error("Error saving config:", error);
      toast.error("Failed to save configuration");
    } finally {
      setSaving(false);
    }
  };

  const handleAddUrl = () => {
    if (!urlInput.trim()) return;
    const urls = config?.allowed_urls || [];
    setConfig({
      ...config,
      allowed_urls: [...urls, urlInput.trim()],
    });
    setUrlInput("");
  };

  const handleRemoveUrl = (index: number) => {
    const urls = [...(config?.allowed_urls || [])];
    urls.splice(index, 1);
    setConfig({ ...config, allowed_urls: urls });
  };

  const generateEmbedCode = () => {
    const configId = config?.id || "YOUR_CONFIG_ID";
    return `<script>
  (function() {
    var script = document.createElement('script');
    script.src = 'https://cdn.klariqo.com/widget.js';
    script.setAttribute('data-config-id', '${configId}');
    document.head.appendChild(script);
  })();
</script>`;
  };

  const copyEmbedCode = () => {
    navigator.clipboard.writeText(generateEmbedCode());
    toast.success("Embed code copied to clipboard");
  };

  if (roleLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Widget Customization</h1>
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground">
              You need admin access to customize widget settings.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Widget Customization</h1>
        <p className="text-muted-foreground mt-2">
          Customize your AI voice widget to match your brand
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-6">
          <Tabs defaultValue="appearance" className="space-y-6">
        <TabsList>
          <TabsTrigger value="appearance">Appearance</TabsTrigger>
          <TabsTrigger value="behavior">Behavior</TabsTrigger>
          <TabsTrigger value="embed">Embed Code</TabsTrigger>
        </TabsList>

        <TabsContent value="appearance" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Widget Appearance</CardTitle>
              <CardDescription>
                Customize how your widget looks on your website
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="position">Widget Position</Label>
                <Select
                  value={config?.position}
                  onValueChange={(value) =>
                    setConfig({ ...config, position: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bottom-right">Bottom Right</SelectItem>
                    <SelectItem value="bottom-left">Bottom Left</SelectItem>
                    <SelectItem value="custom">Custom Position</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="color">Primary Color</Label>
                <div className="flex gap-2">
                  <Input
                    id="color"
                    value={config?.primary_color || "#6366f1"}
                    onChange={(e) =>
                      setConfig({ ...config, primary_color: e.target.value })
                    }
                    placeholder="#6366f1"
                  />
                  <div
                    className="w-12 h-10 rounded border border-border"
                    style={{ backgroundColor: config?.primary_color || "#6366f1" }}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Button Icon</Label>
                <div className="flex gap-4">
                  {PRESET_ICONS.map((preset) => (
                    <Button
                      key={preset.name}
                      variant="outline"
                      size="icon"
                      className="h-12 w-12"
                      onClick={() =>
                        setConfig({ ...config, button_icon_url: preset.name })
                      }
                    >
                      <preset.icon className="h-6 w-6" />
                    </Button>
                  ))}
                  <Button
                    variant="outline"
                    className="h-12"
                    onClick={() => document.getElementById("icon-upload")?.click()}
                  >
                    <Upload className="mr-2 h-4 w-4" />
                    Upload SVG
                  </Button>
                  <input
                    id="icon-upload"
                    type="file"
                    accept=".svg"
                    className="hidden"
                    onChange={(e) => setIconFile(e.target.files?.[0] || null)}
                  />
                </div>
                {iconFile && (
                  <p className="text-sm text-muted-foreground">
                    Selected: {iconFile.name}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="button-text">Button Text</Label>
                <Input
                  id="button-text"
                  value={config?.button_text || ""}
                  onChange={(e) =>
                    setConfig({ ...config, button_text: e.target.value })
                  }
                  placeholder="Talk to Sales"
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="behavior" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Widget Behavior</CardTitle>
              <CardDescription>
                Configure when and where the widget appears
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="trigger">Trigger</Label>
                <Select
                  value={config?.trigger_type}
                  onValueChange={(value) =>
                    setConfig({ ...config, trigger_type: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="immediately">Immediately</SelectItem>
                    <SelectItem value="after_delay">After Delay</SelectItem>
                    <SelectItem value="on_scroll">On Scroll</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {config?.trigger_type === "after_delay" && (
                <div className="space-y-2">
                  <Label htmlFor="delay">Delay (seconds)</Label>
                  <Input
                    id="delay"
                    type="number"
                    value={config?.trigger_delay || 0}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        trigger_delay: parseInt(e.target.value),
                      })
                    }
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label>Display on Pages</Label>
                <Select
                  value={config?.display_mode}
                  onValueChange={(value) =>
                    setConfig({ ...config, display_mode: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all_pages">All Pages</SelectItem>
                    <SelectItem value="specific_urls">Specific URLs</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {config?.display_mode === "specific_urls" && (
                <div className="space-y-2">
                  <Label>Allowed URLs</Label>
                  <div className="flex gap-2">
                    <Input
                      value={urlInput}
                      onChange={(e) => setUrlInput(e.target.value)}
                      placeholder="https://example.com/page"
                      onKeyPress={(e) => e.key === "Enter" && handleAddUrl()}
                    />
                    <Button onClick={handleAddUrl}>Add</Button>
                  </div>
                  <div className="space-y-1">
                    {config?.allowed_urls?.map((url: string, index: number) => (
                      <div
                        key={index}
                        className="flex items-center justify-between p-2 bg-muted rounded"
                      >
                        <span className="text-sm">{url}</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveUrl(index)}
                        >
                          Remove
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between">
                <Label htmlFor="hide-mobile">Hide on Mobile</Label>
                <Switch
                  id="hide-mobile"
                  checked={config?.hide_on_mobile || false}
                  onCheckedChange={(checked) =>
                    setConfig({ ...config, hide_on_mobile: checked })
                  }
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="embed" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Embed Code</CardTitle>
              <CardDescription>
                Copy this code and paste it before the closing &lt;/head&gt; tag on your website
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="relative">
                <Textarea
                  value={generateEmbedCode()}
                  readOnly
                  className="font-mono text-sm min-h-[150px]"
                />
                <Button
                  size="sm"
                  variant="secondary"
                  className="absolute top-2 right-2"
                  onClick={copyEmbedCode}
                >
                  <Copy className="mr-2 h-4 w-4" />
                  Copy
                </Button>
              </div>

              <div className="space-y-2">
                <h3 className="font-semibold">Installation Instructions</h3>
                <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
                  <li>Copy the embed code above</li>
                  <li>Open your website's HTML file</li>
                  <li>Paste the code before the closing &lt;/head&gt; tag</li>
                  <li>Save and publish your changes</li>
                  <li>The widget will appear on your website automatically</li>
                </ol>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving}>
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Save Configuration
        </Button>
      </div>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Live Preview</CardTitle>
              <CardDescription>
                See how your widget will appear on your website
              </CardDescription>
            </CardHeader>
            <CardContent>
              <WidgetPreview
                position={config?.position || "bottom-right"}
                primaryColor={config?.primary_color || "#6366f1"}
                buttonText={config?.button_text || "Talk to Sales"}
                buttonIcon={config?.button_icon_url}
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
