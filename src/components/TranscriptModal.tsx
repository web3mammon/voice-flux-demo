import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Play, Flag } from "lucide-react";
import { toast } from "sonner";

interface TranscriptModalProps {
  open: boolean;
  onClose: () => void;
  call: {
    id: string;
    created_at: string;
    phone_number: string;
    duration: number;
    sentiment: string;
    transcript: string;
    topics: string[];
  } | null;
}

export function TranscriptModal({ open, onClose, call }: TranscriptModalProps) {
  if (!call) return null;

  const handleReportIssue = () => {
    toast.success("Issue reported. Our team will review this call.");
  };

  const confidenceScore = Math.floor(Math.random() * 20) + 80; // Demo: 80-100%

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Call Transcript</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Call metadata */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Phone Number</p>
              <p className="font-medium">{call.phone_number || "Unknown"}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Duration</p>
              <p className="font-medium">{call.duration}s</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Sentiment</p>
              <Badge
                variant={
                  call.sentiment === "positive"
                    ? "default"
                    : call.sentiment === "negative"
                    ? "destructive"
                    : "secondary"
                }
              >
                {call.sentiment}
              </Badge>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">AI Confidence</p>
              <p className="font-medium">{confidenceScore}%</p>
            </div>
          </div>

          <Separator />

          {/* Audio playback */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Button size="icon" variant="outline">
                    <Play className="h-4 w-4" />
                  </Button>
                  <div>
                    <p className="text-sm font-medium">Call Recording</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(call.created_at).toLocaleString()}
                    </p>
                  </div>
                </div>
                <Button variant="ghost" size="sm" onClick={handleReportIssue}>
                  <Flag className="mr-2 h-4 w-4" />
                  Report Issue
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Transcript */}
          <div className="space-y-2">
            <h3 className="font-semibold">Full Transcript</h3>
            <Card>
              <CardContent className="pt-6">
                <div className="space-y-4 text-sm">
                  {call.transcript ? (
                    <p className="whitespace-pre-wrap">{call.transcript}</p>
                  ) : (
                    <p className="text-muted-foreground italic">
                      No transcript available for this call.
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Detected topics */}
          {call.topics && call.topics.length > 0 && (
            <div className="space-y-2">
              <h3 className="font-semibold">Detected Topics</h3>
              <div className="flex flex-wrap gap-2">
                {call.topics.map((topic, index) => (
                  <Badge key={index} variant="outline">
                    {topic}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
