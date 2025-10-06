import { supabase } from "@/integrations/supabase/client";

export interface Message {
  role: "user" | "assistant";
  content: string;
}

export const processVoiceInput = async (
  audioBlob: Blob,
  conversationHistory: Message[]
): Promise<{ userText: string; aiText: string; audioContent: string | null }> => {
  try {
    // Convert blob to base64
    const arrayBuffer = await audioBlob.arrayBuffer();
    const base64Audio = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));

    console.log('Sending audio to voice pipeline...');

    const { data, error } = await supabase.functions.invoke('voice-pipeline', {
      body: {
        audio: base64Audio,
        conversationHistory: conversationHistory.map(msg => ({
          role: msg.role,
          content: msg.content
        }))
      }
    });

    if (error) {
      console.error('Edge function error:', error);
      throw error;
    }

    console.log('Received response from voice pipeline');
    return data;
  } catch (error) {
    console.error('Error processing voice input:', error);
    throw error;
  }
};
