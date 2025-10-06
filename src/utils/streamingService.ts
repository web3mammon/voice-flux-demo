export interface Message {
  role: "user" | "assistant";
  content: string;
}

export interface StreamCallbacks {
  onUserText: (text: string) => void;
  onTextDelta: (delta: string) => void;
  onAudioChunk: (audioBase64: string) => void;
  onComplete: (fullText: string) => void;
  onError: (error: string) => void;
}

export const startVoiceStream = async (
  audioBlob: Blob,
  conversationHistory: Message[],
  callbacks: StreamCallbacks
) => {
  try {
    const arrayBuffer = await audioBlob.arrayBuffer();
    const base64Audio = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

    const response = await fetch(`${supabaseUrl}/functions/v1/voice-stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseKey}`,
      },
      body: JSON.stringify({
        audio: base64Audio,
        conversationHistory: conversationHistory.map(msg => ({
          role: msg.role,
          content: msg.content
        }))
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error('No response body');

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          
          try {
            const parsed = JSON.parse(data);

            switch (parsed.type) {
              case 'empty':
                // No speech detected
                return;
              case 'user_text':
                callbacks.onUserText(parsed.text);
                break;
              case 'text_delta':
                callbacks.onTextDelta(parsed.text);
                break;
              case 'audio_chunk':
                callbacks.onAudioChunk(parsed.audio);
                break;
              case 'complete':
                callbacks.onComplete(parsed.fullText);
                break;
              case 'error':
                callbacks.onError(parsed.error);
                break;
            }
          } catch (e) {
            console.error('Parse error:', e);
          }
        }
      }
    }
  } catch (error) {
    console.error('Stream error:', error);
    callbacks.onError(error instanceof Error ? error.message : 'Unknown error');
  }
};
