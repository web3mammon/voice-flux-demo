import { useEffect, useRef } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { User, Bot, Loader2 } from "lucide-react";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface ChatTranscriptProps {
  messages: Message[];
  currentAssistantMessage?: string;
  state?: "idle" | "listening" | "thinking" | "speaking";
}

const ChatTranscript = ({ messages, currentAssistantMessage, state }: ChatTranscriptProps) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Auto-scroll to bottom
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, currentAssistantMessage]);

  return (
    <div className="w-full h-[600px] rounded-2xl border border-white/10 bg-card/30 backdrop-blur-xl overflow-hidden shadow-2xl">
      <ScrollArea className="h-full p-6" ref={scrollRef}>
        <div className="space-y-6">
          {messages.map((message, index) => (
            <div
              key={index}
              className={cn(
                "flex gap-4 animate-fade-in",
                message.role === "user" ? "justify-end" : "justify-start"
              )}
            >
              {message.role === "assistant" && (
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gradient-to-br from-primary to-primary/50 flex items-center justify-center">
                  <Bot className="h-5 w-5 text-white" />
                </div>
              )}
              
              <div
                className={cn(
                  "rounded-2xl px-6 py-4 max-w-[75%] backdrop-blur-sm shadow-lg",
                  message.role === "user"
                    ? "bg-gradient-to-br from-secondary/80 to-secondary/60 text-white ml-auto"
                    : "bg-gradient-to-br from-primary/20 to-primary/10 text-foreground border border-primary/20"
                )}
              >
                <p className="text-base leading-relaxed font-light">{message.content}</p>
              </div>

              {message.role === "user" && (
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gradient-to-br from-secondary to-secondary/50 flex items-center justify-center">
                  <User className="h-5 w-5 text-white" />
                </div>
              )}
            </div>
          ))}

          {/* Current streaming assistant message */}
          {currentAssistantMessage && (
            <div className="flex gap-4 animate-fade-in justify-start">
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gradient-to-br from-primary to-primary/50 flex items-center justify-center">
                <Bot className="h-5 w-5 text-white" />
              </div>
              
              <div className="rounded-2xl px-6 py-4 max-w-[75%] bg-gradient-to-br from-primary/20 to-primary/10 text-foreground border border-primary/20 backdrop-blur-sm shadow-lg">
                <p className="text-base leading-relaxed font-light">
                  {currentAssistantMessage}
                  {state === "thinking" && (
                    <Loader2 className="inline-block ml-2 h-4 w-4 animate-spin" />
                  )}
                </p>
              </div>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
};

export default ChatTranscript;
