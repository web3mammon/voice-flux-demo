import { useState, useRef } from "react";
import VoiceOrb from "@/components/VoiceOrb";
import ChatTranscript from "@/components/ChatTranscript";
import { Button } from "@/components/ui/button";
import { Mic, MicOff } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { AudioRecorder } from "@/utils/audioUtils";
import { startVoiceStream, type Message } from "@/utils/streamingService";
import { AudioQueue } from "@/utils/audioQueue";

type ConversationState = "idle" | "listening" | "thinking" | "speaking";

const Index = () => {
  const [state, setState] = useState<ConversationState>("idle");
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentAssistantMessage, setCurrentAssistantMessage] = useState("");
  const [isActive, setIsActive] = useState(false);
  const { toast } = useToast();
  
  const audioRecorderRef = useRef<AudioRecorder | null>(null);
  const audioQueueRef = useRef<AudioQueue | null>(null);

  const handleAudioData = async (audioBlob: Blob) => {
    console.log('handleAudioData called, state:', state);
    if (state !== "listening") {
      console.log('Not in listening state, ignoring audio');
      return;
    }

    console.log('Setting state to thinking, audio blob size:', audioBlob.size);
    setState("thinking");
    setCurrentAssistantMessage("");

    // Initialize audio queue
    audioQueueRef.current = new AudioQueue(() => {
      console.log('Audio playback finished');
      setState("listening");
    });

    try {
      await startVoiceStream(audioBlob, messages, {
        onUserText: (text) => {
          console.log('User said:', text);
          setMessages(prev => [...prev, { role: "user", content: text }]);
        },
        onTextDelta: (delta) => {
          setCurrentAssistantMessage(prev => prev + delta);
          setState("speaking");
        },
        onAudioChunk: (audioBase64) => {
          audioQueueRef.current?.addChunk(audioBase64);
        },
        onComplete: (fullText) => {
          console.log('AI response complete:', fullText);
          setMessages(prev => [...prev, { role: "assistant", content: fullText }]);
          setCurrentAssistantMessage("");
        },
        onError: (error) => {
          console.error('Stream error:', error);
          toast({
            title: "Error",
            description: error,
            variant: "destructive",
          });
          setState("listening");
          setCurrentAssistantMessage("");
        }
      });
    } catch (error) {
      console.error('Error processing voice:', error);
      console.error('Error details:', {
        message: error instanceof Error ? error.message : 'Unknown',
        stack: error instanceof Error ? error.stack : undefined
      });
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to process voice input",
        variant: "destructive",
      });
      setState("listening");
      setCurrentAssistantMessage("");
    }
  };

  const startConversation = async () => {
    console.log('Starting conversation...');
    try {
      console.log('Creating audio recorder...');
      audioRecorderRef.current = new AudioRecorder();
      console.log('Requesting microphone access...');
      await audioRecorderRef.current.start(handleAudioData);
      
      setIsActive(true);
      setState("listening");
      
      toast({
        title: "Listening",
        description: "Start speaking! I'll process your voice automatically.",
      });
    } catch (error) {
      console.error('Error starting conversation:', error);
      toast({
        title: "Error",
        description: "Could not access microphone. Please check permissions.",
        variant: "destructive",
      });
    }
  };

  const stopConversation = () => {
    audioRecorderRef.current?.stop();
    audioQueueRef.current?.stop();
    
    setIsActive(false);
    setState("idle");
    setCurrentAssistantMessage("");
    
    toast({
      title: "Conversation Ended",
      description: "Voice session has been terminated.",
    });
  };

  return (
    <div className="min-h-screen flex flex-col p-6 relative overflow-hidden">
      {/* Background gradient effects */}
      <div className="absolute inset-0 bg-gradient-radial from-primary/10 via-transparent to-transparent" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-gradient-radial from-secondary/20 via-transparent to-transparent blur-3xl" />
      
      <div className="relative z-10 w-full max-w-6xl mx-auto flex-1 flex flex-col">
        {/* Header */}
        <div className="text-center space-y-4 py-8 animate-fade-in">
          <h1 className="text-6xl font-extralight tracking-tight bg-gradient-to-r from-primary via-secondary to-primary bg-clip-text text-transparent">
            Voice AI Agent
          </h1>
          <p className="text-muted-foreground text-lg font-light">
            Powered by Deepgram Flux • GPT-4.1 • ElevenLabs
          </p>
        </div>

        {/* Main content area */}
        <div className="flex-1 flex items-center justify-center">
          {messages.length === 0 && !currentAssistantMessage ? (
            /* Show orb when no conversation */
            <VoiceOrb state={state} />
          ) : (
            /* Show chat transcript when conversation started */
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
              {state === "idle" ? "Ready" : state === "listening" ? "Listening..." : state === "thinking" ? "Processing..." : "Speaking..."}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;
