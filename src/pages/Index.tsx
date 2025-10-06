import { useState } from "react";
import VoiceOrb from "@/components/VoiceOrb";
import TranscriptDisplay from "@/components/TranscriptDisplay";
import { Button } from "@/components/ui/button";
import { Mic, MicOff } from "lucide-react";

type ConversationState = "idle" | "listening" | "thinking" | "speaking";

const Index = () => {
  const [state, setState] = useState<ConversationState>("idle");
  const [transcript, setTranscript] = useState<Array<{ role: "user" | "assistant"; text: string }>>([]);
  const [isActive, setIsActive] = useState(false);

  const startConversation = () => {
    setIsActive(true);
    setState("listening");
    // TODO: Initialize voice pipeline
  };

  const stopConversation = () => {
    setIsActive(false);
    setState("idle");
    // TODO: Cleanup voice pipeline
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* Background gradient effects */}
      <div className="absolute inset-0 bg-gradient-radial from-primary/20 via-transparent to-transparent opacity-50" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-gradient-radial from-secondary/30 via-transparent to-transparent blur-3xl" />
      
      <div className="relative z-10 w-full max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center space-y-3 animate-fade-in">
          <h1 className="text-5xl font-bold bg-gradient-to-r from-primary via-secondary to-primary bg-clip-text text-transparent">
            Voice AI Agent
          </h1>
          <p className="text-muted-foreground text-lg">
            Powered by Deepgram Flux • GPT • ElevenLabs
          </p>
        </div>

        {/* Voice Orb */}
        <VoiceOrb state={state} />

        {/* Transcript */}
        <TranscriptDisplay transcript={transcript} />

        {/* Controls */}
        <div className="flex justify-center gap-4">
          {!isActive ? (
            <Button
              onClick={startConversation}
              size="lg"
              className="bg-gradient-to-r from-primary to-secondary hover:opacity-90 transition-all duration-300 text-white px-8 py-6 text-lg shadow-lg hover:shadow-primary/50"
            >
              <Mic className="mr-2 h-5 w-5" />
              Start Conversation
            </Button>
          ) : (
            <Button
              onClick={stopConversation}
              size="lg"
              variant="destructive"
              className="px-8 py-6 text-lg shadow-lg"
            >
              <MicOff className="mr-2 h-5 w-5" />
              End Conversation
            </Button>
          )}
        </div>

        {/* Status indicator */}
        <div className="text-center">
          <p className="text-sm text-muted-foreground capitalize">
            {state === "idle" ? "Ready to start" : state}
          </p>
        </div>
      </div>
    </div>
  );
};

export default Index;
