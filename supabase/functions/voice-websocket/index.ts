import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface VoiceSession {
  transcript: Array<{ role: string; content: string; timestamp: string }>;
  conversationHistory: Array<{ role: string; content: string }>;
  deepgramConnection: WebSocket | null;
  isProcessing: boolean;
}

const sessions = new Map<string, VoiceSession>();

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const { headers } = req;
  const upgradeHeader = headers.get("upgrade") || "";

  if (upgradeHeader.toLowerCase() !== "websocket") {
    return new Response("Expected WebSocket connection", { status: 400 });
  }

  console.log(`[WebSocket] New connection`);

  const { socket, response } = Deno.upgradeWebSocket(req);
  const sessionId = crypto.randomUUID();

  socket.onopen = async () => {
    console.log(`[WebSocket] Connected - Session: ${sessionId}`);

    const session: VoiceSession = {
      transcript: [],
      conversationHistory: [],
      deepgramConnection: null,
      isProcessing: false,
    };

    sessions.set(sessionId, session);

    // Initialize Deepgram WebSocket
    const deepgramReady = await initializeDeepgram(sessionId, socket);

    if (!deepgramReady) {
      socket.send(JSON.stringify({ type: 'error', message: 'Voice recognition failed' }));
      socket.close();
      return;
    }

    socket.send(JSON.stringify({
      type: 'connection.established',
      sessionId,
      message: 'Voice assistant ready'
    }));
  };

  socket.onmessage = async (event) => {
    try {
      const session = sessions.get(sessionId);
      if (!session) return;

      const data = JSON.parse(event.data);

      if (data.type === 'audio.chunk') {
        // Forward audio to Deepgram
        const audioData = Uint8Array.from(atob(data.audio), c => c.charCodeAt(0));
        if (session.deepgramConnection?.readyState === WebSocket.OPEN) {
          session.deepgramConnection.send(audioData);
        }
      } else if (data.type === 'session.end') {
        session.deepgramConnection?.close();
        socket.close();
      }
    } catch (error) {
      console.error('[WebSocket] Error:', error);
    }
  };

  socket.onclose = () => {
    const session = sessions.get(sessionId);
    session?.deepgramConnection?.close();
    sessions.delete(sessionId);
    console.log(`[WebSocket] Closed - ${sessionId}`);
  };

  return response;
});

async function initializeDeepgram(sessionId: string, clientSocket: WebSocket): Promise<boolean> {
  const session = sessions.get(sessionId);
  if (!session) return false;

  const DEEPGRAM_API_KEY = Deno.env.get('DEEPGRAM_API_KEY');
  if (!DEEPGRAM_API_KEY) {
    console.error('[Deepgram] API key missing');
    return false;
  }

  try {
    const deepgramWs = new WebSocket(
      'wss://api.deepgram.com/v1/listen?' + new URLSearchParams({
        encoding: 'linear16',
        sample_rate: '24000',
        channels: '1',
        interim_results: 'true',
        punctuate: 'true',
        endpointing: '1000',  // 1 second of silence
      }),
      ['token', DEEPGRAM_API_KEY]
    );

    const connectionPromise = new Promise<boolean>((resolve) => {
      const timeout = setTimeout(() => resolve(false), 10000);

      deepgramWs.onopen = () => {
        clearTimeout(timeout);
        session.deepgramConnection = deepgramWs;
        console.log('[Deepgram] Connected');
        resolve(true);
      };

      deepgramWs.onerror = () => {
        clearTimeout(timeout);
        resolve(false);
      };
    });

    deepgramWs.onmessage = async (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data.type === 'Results') {
          const transcript = data.channel?.alternatives?.[0]?.transcript;
          const isFinal = data.is_final;

          if (transcript?.trim()) {
            clientSocket.send(JSON.stringify({
              type: 'transcript.update',
              text: transcript,
              isFinal
            }));

            // Process when final and not already processing
            if (isFinal && !session.isProcessing) {
              session.isProcessing = true;
              session.transcript.push({
                role: 'customer',
                content: transcript,
                timestamp: new Date().toISOString()
              });

              await processWithGPT(sessionId, transcript, clientSocket);
            }
          }
        }
      } catch (error) {
        console.error('[Deepgram] Error:', error);
      }
    };

    return await connectionPromise;
  } catch (error) {
    console.error('[Deepgram] Connection error:', error);
    return false;
  }
}

async function processWithGPT(sessionId: string, userInput: string, socket: WebSocket) {
  const session = sessions.get(sessionId);
  if (!session) return;

  const GROQ_API_KEY = Deno.env.get('GROQ_API_KEY');
  if (!GROQ_API_KEY) {
    console.error('[Groq] API key missing');
    session.isProcessing = false;
    return;
  }

  const systemPrompt = `You are Jennifer, NLC's friendly AI assistant helping clients understand NLC's design services.

NLC (NoLimit Creatives) is a premium unlimited design subscription service for e-commerce brands, marketing agencies, and enterprises.

Services: Social media ads, website design, logos & branding, motion graphics, presentations, email designs, Amazon content, video editing, illustrations, packaging, print design.

Plans:
1. Digital Ads Plan
2. Ecom Plan
3. Marketing Plan
4. Full Stack Plan (unlimited revisions)

Keep responses under 40 words, warm and professional. Help clients find the right service for their needs.`;

  try {
    const messages = [
      { role: 'system', content: systemPrompt },
      ...session.conversationHistory.slice(-8),
      { role: 'user', content: userInput }
    ];

    console.log('[GPT-OSS] Streaming from Groq...');

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'openai/gpt-oss-20b',
        messages,
        max_tokens: 150,
        temperature: 0.7,
        stream: true,
      })
    });

    if (!response.ok) throw new Error(`Groq error: ${response.status}`);

    const reader = response.body?.getReader();
    const decoder = new TextDecoder();
    let fullResponse = '';
    let sentenceBuffer = '';
    let chunkIndex = 0;

    if (reader) {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n').filter(line => line.trim());

        for (const line of lines) {
          if (line.startsWith('data: ') && line.slice(6) !== '[DONE]') {
            try {
              const parsed = JSON.parse(line.slice(6));
              const content = parsed.choices[0]?.delta?.content;

              if (content) {
                fullResponse += content;
                sentenceBuffer += content;

                // Check for sentence endings
                if (/[.!?]/.test(content)) {
                  const sentences = sentenceBuffer.split(/([.!?]\s+)/);
                  for (let i = 0; i < sentences.length - 1; i += 2) {
                    const sentence = (sentences[i] + (sentences[i + 1] || '')).trim();
                    if (sentence) {
                      socket.send(JSON.stringify({ type: 'text.chunk', text: sentence }));
                      generateSpeechChunk(sessionId, sentence, socket, chunkIndex++);
                    }
                  }
                  sentenceBuffer = sentences[sentences.length - 1] || '';
                }
              }
            } catch {}
          }
        }
      }
    }

    // Send remaining text
    if (sentenceBuffer.trim()) {
      socket.send(JSON.stringify({ type: 'text.chunk', text: sentenceBuffer.trim() }));
      await generateSpeechChunk(sessionId, sentenceBuffer.trim(), socket, chunkIndex++);
    }

    const aiResponse = fullResponse || 'I didn\'t catch that.';

    socket.send(JSON.stringify({ type: 'text.complete', text: aiResponse }));
    socket.send(JSON.stringify({ type: 'audio.complete', total_chunks: chunkIndex }));

    session.conversationHistory.push(
      { role: 'user', content: userInput },
      { role: 'assistant', content: aiResponse }
    );

    session.transcript.push({
      role: 'assistant',
      content: aiResponse,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('[GPT-OSS] Error:', error);
    socket.send(JSON.stringify({ type: 'error', message: 'Failed to process' }));
  } finally {
    session.isProcessing = false;
  }
}

async function generateSpeechChunk(sessionId: string, text: string, socket: WebSocket, chunkIndex: number) {
  const session = sessions.get(sessionId);
  if (!session || !text.trim()) return;

  const ELEVENLABS_API_KEY = Deno.env.get('ELEVENLABS_API_KEY');
  if (!ELEVENLABS_API_KEY) return;

  try {
    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/YhNmhaaLcHbuyfVn0UeL`,
      {
        method: 'POST',
        headers: {
          'Accept': 'audio/mpeg',
          'Content-Type': 'application/json',
          'xi-api-key': ELEVENLABS_API_KEY
        },
        body: JSON.stringify({
          text,
          model_id: 'eleven_turbo_v2_5',
          voice_settings: { stability: 0.5, similarity_boost: 0.75 }
        })
      }
    );

    if (!response.ok) return;

    const audioBuffer = await response.arrayBuffer();
    const bytes = new Uint8Array(audioBuffer);

    // Convert to base64
    let binary = '';
    for (let i = 0; i < bytes.length; i += 0x8000) {
      const chunk = bytes.subarray(i, Math.min(i + 0x8000, bytes.length));
      binary += String.fromCharCode(...Array.from(chunk));
    }

    socket.send(JSON.stringify({
      type: 'audio.chunk',
      audio: btoa(binary),
      chunk_index: chunkIndex
    }));

    console.log(`[TTS-Chunk #${chunkIndex}] Sent ${bytes.length} bytes`);
  } catch (error) {
    console.error(`[TTS-Chunk #${chunkIndex}] Error:`, error);
  }
}
