import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Save, History, ExternalLink } from "lucide-react";
import { Link } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface SystemPromptEditorProps {
  config: any;
  onUpdate: (updates: any) => void;
}

export function SystemPromptEditor({ config, onUpdate }: SystemPromptEditorProps) {
  const [prompt, setPrompt] = useState(config?.system_prompt || "");
  const [saving, setSaving] = useState(false);
  const [versions, setVersions] = useState<any[]>([]);
  const [showVersions, setShowVersions] = useState(false);
  const { toast } = useToast();

  const handleSave = async () => {
    setSaving(true);
    try {
      // Save version history
      const { data: versionNumber } = await supabase
        .rpc("get_next_version_number", { p_config_id: config.id });

      await supabase.from("prompt_versions").insert({
        config_id: config.id,
        version_number: versionNumber,
        system_prompt: prompt,
        created_by: (await supabase.auth.getUser()).data.user?.id,
      });

      // Update active config
      await onUpdate({ system_prompt: prompt });

      toast({
        title: "Deployed!",
        description: "System prompt is now live",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const loadVersions = async () => {
    try {
      const { data, error } = await supabase
        .from("prompt_versions")
        .select("*")
        .eq("config_id", config.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setVersions(data || []);
      setShowVersions(true);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const rollbackToVersion = async (version: any) => {
    setPrompt(version.system_prompt);
    setShowVersions(false);
    toast({
      title: "Restored",
      description: `Loaded version ${version.version_number}. Click Save & Deploy to make it live.`,
    });
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>System Prompt Editor</CardTitle>
            <CardDescription>
              Configure how Jennifer responds to users
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Link to="/">
              <Button variant="outline" size="sm">
                <ExternalLink className="h-4 w-4 mr-2" />
                Try it Now
              </Button>
            </Link>
            <Dialog open={showVersions} onOpenChange={setShowVersions}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" onClick={loadVersions}>
                  <History className="h-4 w-4 mr-2" />
                  Version History
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Version History</DialogTitle>
                  <DialogDescription>
                    Rollback to a previous version of the system prompt
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  {versions.map((version) => (
                    <Card key={version.id}>
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-sm">
                            Version {version.version_number}
                          </CardTitle>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => rollbackToVersion(version)}
                          >
                            Restore
                          </Button>
                        </div>
                        <CardDescription>
                          {new Date(version.created_at).toLocaleString()}
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm whitespace-pre-wrap line-clamp-3">
                          {version.system_prompt}
                        </p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <Textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          className="min-h-[400px] font-mono text-sm"
          placeholder="Enter system prompt..."
        />
        <div className="flex justify-between items-center">
          <p className="text-sm text-muted-foreground">
            Current version: {config?.prompt_version}
          </p>
          <Button onClick={handleSave} disabled={saving || prompt === config?.system_prompt}>
            <Save className="h-4 w-4 mr-2" />
            {saving ? "Deploying..." : "Save & Deploy"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
