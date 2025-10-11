import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Edit, Save, X } from "lucide-react";

interface ResponseTemplatesProps {
  configId: string;
}

const TEMPLATE_TYPES = [
  { type: "greeting", label: "Greeting Message", default: "Hi! I'm Jennifer, NLC's AI assistant. How can I help you today?" },
  { type: "pricing", label: "Pricing Explanation", default: "We offer four pricing tiers: Digital Ads ($495/mo), Ecom ($695/mo), Marketing ($995/mo), and Full Stack ($1495/mo). All include unlimited revisions!" },
  { type: "after_hours", label: "After-Hours Message", default: "Thanks for reaching out! Our team is currently offline, but I can help answer questions about our services. What would you like to know?" },
  { type: "escalation", label: "Escalation Message", default: "Let me connect you with a team member who can better assist you. One moment please!" },
  { type: "goodbye", label: "Goodbye Message", default: "Thanks for chatting! Feel free to reach out anytime. Have a great day!" },
];

export function ResponseTemplates({ configId }: ResponseTemplatesProps) {
  const [templates, setTemplates] = useState<any[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const { toast } = useToast();

  useEffect(() => {
    if (configId) {
      fetchTemplates();
    }
  }, [configId]);

  const fetchTemplates = async () => {
    try {
      const { data, error } = await supabase
        .from("response_templates")
        .select("*")
        .eq("config_id", configId);

      if (error) throw error;

      // Create default templates if they don't exist
      const existingTypes = data?.map((t) => t.template_type) || [];
      const missingTypes = TEMPLATE_TYPES.filter((t) => !existingTypes.includes(t.type));

      if (missingTypes.length > 0) {
        const newTemplates = missingTypes.map((t) => ({
          config_id: configId,
          template_type: t.type,
          content: t.default,
        }));

        const { error: insertError } = await supabase
          .from("response_templates")
          .insert(newTemplates);

        if (insertError) throw insertError;

        // Refetch after creating defaults
        fetchTemplates();
        return;
      }

      setTemplates(data || []);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const startEdit = (template: any) => {
    setEditing(template.template_type);
    setEditContent(template.content);
  };

  const cancelEdit = () => {
    setEditing(null);
    setEditContent("");
  };

  const saveTemplate = async (templateType: string) => {
    try {
      const { error } = await supabase
        .from("response_templates")
        .update({ content: editContent, updated_at: new Date().toISOString() })
        .eq("config_id", configId)
        .eq("template_type", templateType);

      if (error) throw error;

      toast({
        title: "Saved",
        description: "Template updated successfully",
      });

      setEditing(null);
      fetchTemplates();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const getTemplateLabel = (type: string) => {
    return TEMPLATE_TYPES.find((t) => t.type === type)?.label || type;
  };

  return (
    <div className="space-y-4">
      {TEMPLATE_TYPES.map((templateDef) => {
        const template = templates.find((t) => t.template_type === templateDef.type);
        const isEditing = editing === templateDef.type;

        return (
          <Card key={templateDef.type}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg">{templateDef.label}</CardTitle>
                  <CardDescription>
                    Quick response for {templateDef.type} scenarios
                  </CardDescription>
                </div>
                {!isEditing && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => startEdit(template)}
                  >
                    <Edit className="h-4 w-4 mr-2" />
                    Edit
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {isEditing ? (
                <div className="space-y-4">
                  <Textarea
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    className="min-h-[100px]"
                  />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => saveTemplate(templateDef.type)}>
                      <Save className="h-4 w-4 mr-2" />
                      Save
                    </Button>
                    <Button size="sm" variant="outline" onClick={cancelEdit}>
                      <X className="h-4 w-4 mr-2" />
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <p className="text-sm whitespace-pre-wrap">
                  {template?.content || templateDef.default}
                </p>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
