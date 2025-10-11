import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";

interface VoiceSettingsProps {
  config: any;
  onUpdate: (updates: any) => void;
}

const ELEVEN_LABS_VOICES = [
  { id: "9BWtsMINqrJLrRacOk9x", name: "Aria" },
  { id: "CwhRBWXzGAHq8TQ4Fs17", name: "Roger" },
  { id: "EXAVITQu4vr4xnSDxMaL", name: "Sarah" },
  { id: "FGY2WhTYpPnrIDTdsKH5", name: "Laura" },
  { id: "IKne3meq5aSn9XLyUdCD", name: "Charlie" },
  { id: "JBFqnCBsd6RMkjVDRZzb", name: "George" },
  { id: "N2lVS1w4EtoT3dr4eOWO", name: "Callum" },
  { id: "SAz9YHcvj6GT2YYXdXww", name: "River" },
  { id: "TX3LPaxmHKxFdv7VOQHJ", name: "Liam" },
  { id: "XB0fDUnXU5powFXDhCwa", name: "Charlotte" },
];

export function VoiceSettings({ config, onUpdate }: VoiceSettingsProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Voice Settings</CardTitle>
        <CardDescription>Configure ElevenLabs voice parameters</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label>Voice Selection</Label>
          <Select
            value={config?.voice_id || "Aria"}
            onValueChange={(value) => onUpdate({ voice_id: value })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select a voice" />
            </SelectTrigger>
            <SelectContent>
              {ELEVEN_LABS_VOICES.map((voice) => (
                <SelectItem key={voice.id} value={voice.name}>
                  {voice.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <div className="flex justify-between">
            <Label>Speech Speed</Label>
            <span className="text-sm text-muted-foreground">
              {config?.voice_speed || 1.0}x
            </span>
          </div>
          <Slider
            value={[config?.voice_speed || 1.0]}
            onValueChange={([value]) => onUpdate({ voice_speed: value })}
            min={0.5}
            max={2.0}
            step={0.1}
            className="w-full"
          />
        </div>

        <div className="space-y-2">
          <div className="flex justify-between">
            <Label>Stability</Label>
            <span className="text-sm text-muted-foreground">
              {((config?.voice_stability || 0.5) * 100).toFixed(0)}%
            </span>
          </div>
          <Slider
            value={[config?.voice_stability || 0.5]}
            onValueChange={([value]) => onUpdate({ voice_stability: value })}
            min={0}
            max={1}
            step={0.05}
            className="w-full"
          />
          <p className="text-xs text-muted-foreground">
            Higher values = more consistent voice, lower values = more expressive
          </p>
        </div>

        <div className="space-y-2">
          <div className="flex justify-between">
            <Label>Clarity</Label>
            <span className="text-sm text-muted-foreground">
              {((config?.voice_clarity || 0.75) * 100).toFixed(0)}%
            </span>
          </div>
          <Slider
            value={[config?.voice_clarity || 0.75]}
            onValueChange={([value]) => onUpdate({ voice_clarity: value })}
            min={0}
            max={1}
            step={0.05}
            className="w-full"
          />
          <p className="text-xs text-muted-foreground">
            Higher values = clearer pronunciation, may reduce naturalness
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
