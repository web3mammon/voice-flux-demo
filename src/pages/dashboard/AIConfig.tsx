import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useUserRole } from "@/hooks/useUserRole";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SystemPromptEditor } from "@/components/ai-config/SystemPromptEditor";
import { VoiceSettings } from "@/components/ai-config/VoiceSettings";
import { BehaviorRules } from "@/components/ai-config/BehaviorRules";
import { ResponseTemplates } from "@/components/ai-config/ResponseTemplates";
import { Loader2 } from "lucide-react";

export default function AIConfig() {
  const [config, setConfig] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const { isAdmin } = useUserRole();

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    try {
      const { data, error } = await supabase
        .from("ai_config")
        .select("*")
        .eq("is_active", true)
        .maybeSingle();

      if (error) throw error;

      if (!data) {
        // Create default config if none exists
        const { data: newConfig, error: createError } = await supabase
          .from("ai_config")
          .insert({
            prompt_version: "v1.0",
            system_prompt: `You are Jennifer, NLC's (No Limit Creatives) AI assistant. You help clients learn about design services, pricing plans, and connect with the team.

About NLC:
- Full-service creative agency
- Services: Social Media Ads, Website Design, Branding, Video Editing, SEO, Email Marketing
- Pricing tiers: Digital Ads ($495/mo), Ecom ($695/mo), Marketing ($995/mo), Full Stack ($1495/mo)
- All plans include unlimited revisions
- White Glove Concierge service available

Your role:
- Answer questions about services and pricing
- Help clients understand which plan fits their needs
- Be friendly, professional, and helpful
- If you don't know something, offer to connect them with the team`,
            is_active: true,
            voice_id: "Aria",
            voice_speed: 1.0,
            voice_stability: 0.5,
            voice_clarity: 0.75,
          })
          .select()
          .single();

        if (createError) throw createError;
        setConfig(newConfig);
      } else {
        setConfig(data);
      }
    } catch (error: any) {
      console.error("Error fetching config:", error);
      toast({
        title: "Error",
        description: "Failed to load AI configuration",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const updateConfig = async (updates: any) => {
    if (!config) return;

    try {
      const { error } = await supabase
        .from("ai_config")
        .update(updates)
        .eq("id", config.id);

      if (error) throw error;

      setConfig({ ...config, ...updates });
      toast({
        title: "Saved",
        description: "Configuration updated successfully",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">AI Configuration</h1>
          <p className="text-muted-foreground">Configure AI prompts and behavior</p>
        </div>
        <div className="text-center py-12 text-muted-foreground">
          You need admin access to configure AI settings.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">AI Configuration</h1>
        <p className="text-muted-foreground">Configure AI prompts and behavior</p>
      </div>

      <Tabs defaultValue="prompt" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="prompt">System Prompt</TabsTrigger>
          <TabsTrigger value="voice">Voice Settings</TabsTrigger>
          <TabsTrigger value="behavior">Behavior Rules</TabsTrigger>
          <TabsTrigger value="templates">Response Templates</TabsTrigger>
        </TabsList>

        <TabsContent value="prompt">
          <SystemPromptEditor config={config} onUpdate={updateConfig} />
        </TabsContent>

        <TabsContent value="voice">
          <VoiceSettings config={config} onUpdate={updateConfig} />
        </TabsContent>

        <TabsContent value="behavior">
          <BehaviorRules config={config} onUpdate={updateConfig} />
        </TabsContent>

        <TabsContent value="templates">
          <ResponseTemplates configId={config?.id} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
