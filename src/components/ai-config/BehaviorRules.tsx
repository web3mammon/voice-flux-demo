import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";

interface BehaviorRulesProps {
  config: any;
  onUpdate: (updates: any) => void;
}

export function BehaviorRules({ config, onUpdate }: BehaviorRulesProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Behavior Rules</CardTitle>
        <CardDescription>Configure AI assistant behavior and safety features</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Auto-escalate to human</Label>
              <p className="text-sm text-muted-foreground">
                Transfer to human agent after repeated failed attempts
              </p>
            </div>
            <Switch
              checked={config?.auto_escalate_enabled || false}
              onCheckedChange={(checked) => onUpdate({ auto_escalate_enabled: checked })}
            />
          </div>
          {config?.auto_escalate_enabled && (
            <div className="ml-4 space-y-2">
              <Label>Failed attempts threshold</Label>
              <Input
                type="number"
                min={1}
                max={10}
                value={config?.auto_escalate_threshold || 3}
                onChange={(e) => onUpdate({ auto_escalate_threshold: parseInt(e.target.value) })}
              />
            </div>
          )}
        </div>

        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label>Collect email before ending</Label>
            <p className="text-sm text-muted-foreground">
              Request email address before call ends
            </p>
          </div>
          <Switch
            checked={config?.collect_email_enabled || false}
            onCheckedChange={(checked) => onUpdate({ collect_email_enabled: checked })}
          />
        </div>

        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label>Send call summary</Label>
            <p className="text-sm text-muted-foreground">
              Email conversation summary to customer
            </p>
          </div>
          <Switch
            checked={config?.send_summary_enabled || false}
            onCheckedChange={(checked) => onUpdate({ send_summary_enabled: checked })}
          />
        </div>

        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label>Enable troll detection</Label>
            <p className="text-sm text-muted-foreground">
              Detect and handle abusive behavior
            </p>
          </div>
          <Switch
            checked={config?.troll_detection_enabled || false}
            onCheckedChange={(checked) => onUpdate({ troll_detection_enabled: checked })}
          />
        </div>

        <div className="space-y-2">
          <Label>Profanity filter sensitivity</Label>
          <Select
            value={config?.profanity_filter || "medium"}
            onValueChange={(value) => onUpdate({ profanity_filter: value })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="low">Low</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="high">High</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Max call duration</Label>
          <Select
            value={config?.max_call_duration?.toString() || "10"}
            onValueChange={(value) => onUpdate({ max_call_duration: parseInt(value) })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="5">5 minutes</SelectItem>
              <SelectItem value="10">10 minutes</SelectItem>
              <SelectItem value="15">15 minutes</SelectItem>
              <SelectItem value="-1">Unlimited</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardContent>
    </Card>
  );
}
