import { useState, useRef, useEffect } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import VoiceOrb from "@/components/VoiceOrb";
import ChatTranscript from "@/components/ChatTranscript";
import { Mic, MicOff } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { AudioRecorder } from "@/utils/audioUtils";
import { VoiceWebSocketService } from "@/utils/websocketService";

type ConversationState = "idle" | "listening" | "thinking" | "speaking";
type Message = { role: "user" | "assistant"; content: string };

const Index = () => {
  const [state, setState] = useState<ConversationState>("idle");
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentAssistantMessage, setCurrentAssistantMessage] = useState("");
  const [isActive, setIsActive] = useState(false);
  const { toast } = useToast();

  const audioRecorderRef = useRef<AudioRecorder | null>(null);
  const wsServiceRef = useRef<VoiceWebSocketService | null>(null);

  useEffect(() => {
    // Cleanup on unmount
    return () => {
      if (wsServiceRef.current) {
        wsServiceRef.current.disconnect();
      }
      if (audioRecorderRef.current) {
        audioRecorderRef.current.stop();
      }
    };
  }, []);

  const startConversation = async () => {
    console.log('[Index] Starting conversation...');
    try {
      // Initialize WebSocket service
      wsServiceRef.current = new VoiceWebSocketService();

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

      // Set up callbacks
      wsServiceRef.current.setCallbacks({
        onTranscriptUpdate: (text, isFinal) => {
          if (isFinal) {
            console.log('[Index] Final transcript:', text);
            setMessages(prev => [...prev, { role: "user", content: text }]);
            setState("thinking");
          }
        },
        onTextChunk: (text) => {
          setCurrentAssistantMessage(prev => prev + text);
          setState("speaking");
        },
        onAudioChunk: (audio, index) => {
          // Audio handled internally by WebSocketService
        },
        onComplete: (text) => {
          console.log('[Index] Complete:', text);
          setMessages(prev => [...prev, { role: "assistant", content: text }]);
          setCurrentAssistantMessage("");
          setState("listening");
        },
        onError: (error) => {
          console.error('[Index] Error:', error);
          toast({
            title: "Error",
            description: error,
            variant: "destructive"
          });
          setState("listening");
        }
      });

      // Connect WebSocket
      await wsServiceRef.current.connect(supabaseUrl);

      // Start audio recording
      audioRecorderRef.current = new AudioRecorder();
      await audioRecorderRef.current.start((audioBase64) => {
        // Send audio chunks to WebSocket
        wsServiceRef.current?.sendAudioChunk(audioBase64);
      });

      setIsActive(true);
      setState("listening");

      toast({
        title: "Listening",
        description: "Start speaking!"
      });

    } catch (error) {
      console.error('[Index] Error starting:', error);
      toast({
        title: "Error",
        description: "Could not start conversation",
        variant: "destructive"
      });
    }
  };

  const stopConversation = () => {
    console.log('[Index] Stopping conversation...');

    if (audioRecorderRef.current) {
      audioRecorderRef.current.stop();
      audioRecorderRef.current = null;
    }

    if (wsServiceRef.current) {
      wsServiceRef.current.endSession();
      wsServiceRef.current.disconnect();
      wsServiceRef.current = null;
    }

    setIsActive(false);
    setState("idle");
    setCurrentAssistantMessage("");

    toast({
      title: "Conversation Ended",
      description: "Session terminated"
    });
  };

  return (
    <div className="min-h-screen flex flex-col p-6 relative overflow-hidden">
      {/* Sign In Button */}
      <div className="absolute top-4 right-4 z-20">
        <Link to="/auth">
          <Button variant="outline">Sign In</Button>
        </Link>
      </div>

      {/* Background gradient effects */}
      <div className="absolute inset-0 bg-gradient-radial from-primary/10 via-transparent to-transparent" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-gradient-radial from-secondary/20 via-transparent to-transparent blur-3xl" />

      <div className="relative z-10 w-full max-w-6xl mx-auto flex-1 flex flex-col">
        {/* Header */}
        <div className="text-center space-y-4 py-8 animate-fade-in">
          <h1 className="text-6xl tracking-tight bg-gradient-to-r from-primary via-secondary to-primary bg-clip-text text-transparent font-extrabold">
            Say Hello to Jennifer
          </h1>
          <p className="text-muted-foreground text-lg font-light">
            NLC's new all round assistant by Klariqo
          </p>
        </div>

        {/* Main content area */}
        <div className="flex-1 flex items-center justify-center">
          {messages.length === 0 && !currentAssistantMessage ? (
            <VoiceOrb state={state} />
          ) : (
            <div className="w-full max-w-4xl">
              <ChatTranscript
                messages={messages}
                currentAssistantMessage={currentAssistantMessage}
                state={state}
              />
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="flex flex-col items-center gap-6 py-8">
          <div className="flex justify-center gap-4">
            {!isActive ? (
              <Button
                onClick={startConversation}
                size="lg"
                className="bg-gradient-to-r from-primary to-secondary hover:opacity-90 transition-all duration-300 text-white px-10 py-7 text-lg font-light shadow-2xl hover:shadow-primary/50 rounded-full"
              >
                <Mic className="mr-3 h-6 w-6" />
                Start Conversation
              </Button>
            ) : (
              <Button
                onClick={stopConversation}
                size="lg"
                variant="destructive"
                className="px-10 py-7 text-lg font-light shadow-2xl rounded-full"
              >
                <MicOff className="mr-3 h-6 w-6" />
                End Conversation
              </Button>
            )}
          </div>

          {/* Status indicator */}
          <div className="text-center min-h-[24px]">
            <p className="text-sm text-muted-foreground font-light tracking-wide uppercase">
              {state === "idle"
                ? "Ready"
                : state === "listening"
                ? "Listening..."
                : state === "thinking"
                ? "Processing..."
                : "Speaking..."}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;
