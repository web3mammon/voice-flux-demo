import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface TranscriptDisplayProps {
  transcript: Message[];
}

const TranscriptDisplay = ({ transcript }: TranscriptDisplayProps) => {
  if (transcript.length === 0) {
    return null;
  }

  return (
    <div className="w-full max-w-2xl mx-auto">
      <ScrollArea className="h-[300px] rounded-lg border border-white/10 bg-card/50 backdrop-blur-xl p-4">
        <div className="space-y-4">
          {transcript.map((message, index) => (
            <div
              key={index}
              className={cn(
                "flex gap-3 animate-fade-in",
                message.role === "user" ? "justify-end" : "justify-start"
              )}
            >
              <div
                className={cn(
                  "rounded-2xl px-4 py-3 max-w-[80%] backdrop-blur-sm",
                  message.role === "user"
                    ? "bg-gradient-to-r from-secondary to-secondary/80 text-white"
                    : "bg-gradient-to-r from-primary to-primary/80 text-white"
                )}
              >
                <p className="text-sm leading-relaxed">{message.content}</p>
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
};

export default TranscriptDisplay;
