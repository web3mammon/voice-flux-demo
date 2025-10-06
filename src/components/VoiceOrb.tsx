import { cn } from "@/lib/utils";

type ConversationState = "idle" | "listening" | "thinking" | "speaking";

interface VoiceOrbProps {
  state: ConversationState;
}

const VoiceOrb = ({ state }: VoiceOrbProps) => {
  const getOrbClasses = () => {
    switch (state) {
      case "listening":
        return "animate-listening-pulse bg-gradient-to-br from-secondary to-secondary/50";
      case "thinking":
        return "animate-pulse-glow bg-gradient-to-br from-accent to-accent/50";
      case "speaking":
        return "animate-pulse-glow bg-gradient-to-br from-primary to-primary/50";
      default:
        return "bg-gradient-to-br from-muted to-muted/50";
    }
  };

  return (
    <div className="flex items-center justify-center py-12">
      <div className="relative">
        {/* Outer glow ring */}
        <div 
          className={cn(
            "absolute inset-0 rounded-full blur-2xl transition-all duration-500",
            state !== "idle" && "opacity-60",
            state === "idle" && "opacity-0"
          )}
          style={{
            background: state === "listening" 
              ? "radial-gradient(circle, hsl(217 91% 60% / 0.5), transparent 70%)"
              : "radial-gradient(circle, hsl(263 70% 60% / 0.5), transparent 70%)"
          }}
        />
        
        {/* Main orb */}
        <div
          className={cn(
            "w-64 h-64 rounded-full backdrop-blur-xl border border-white/10 transition-all duration-500",
            getOrbClasses(),
            "flex items-center justify-center relative overflow-hidden"
          )}
        >
          {/* Inner gradient overlay */}
          <div className="absolute inset-0 bg-gradient-radial from-white/10 via-transparent to-transparent" />
          
          {/* State icon/text */}
          <div className="relative z-10 text-center space-y-2">
            <div className={cn(
              "text-6xl transition-transform duration-300",
              state !== "idle" && "scale-110"
            )}>
              {state === "listening" && "👂"}
              {state === "thinking" && "🤔"}
              {state === "speaking" && "💬"}
              {state === "idle" && "⚡"}
            </div>
            <p className="text-sm font-medium text-white/80 uppercase tracking-wider">
              {state}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VoiceOrb;
