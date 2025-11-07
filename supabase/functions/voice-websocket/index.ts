import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface VoiceSession {
  conversationId: string | null;
  transcript: Array<{ role: string; content: string; timestamp: string }>;
  startTime: number;
  conversationHistory: Array<{ role: string; content: string }>;
  assemblyaiConnection: WebSocket | null;
  cartesiaConnection: WebSocket | null;
  currentContextId: string | null;
  audioChunkIndex: number;
  isProcessing: boolean;
}

const sessions = new Map<string, VoiceSession>();

// Convert PCM to WAV by adding WAV header
function pcmToWav(pcmData: Uint8Array, sampleRate: number, numChannels: number = 1, bitsPerSample: number = 16): Uint8Array {
  const byteRate = sampleRate * numChannels * bitsPerSample / 8;
  const blockAlign = numChannels * bitsPerSample / 8;
  const dataSize = pcmData.length;
  const header = new ArrayBuffer(44);
  const view = new DataView(header);

  // RIFF identifier
  view.setUint32(0, 0x52494646, false); // "RIFF"
  // File length
  view.setUint32(4, 36 + dataSize, true);
  // RIFF type
  view.setUint32(8, 0x57415645, false); // "WAVE"
  // Format chunk identifier
  view.setUint32(12, 0x666d7420, false); // "fmt "
  // Format chunk length
  view.setUint32(16, 16, true);
  // Sample format (raw)
  view.setUint16(20, 1, true);
  // Channel count
  view.setUint16(22, numChannels, true);
  // Sample rate
  view.setUint32(24, sampleRate, true);
  // Byte rate
  view.setUint32(28, byteRate, true);
  // Block align
  view.setUint16(32, blockAlign, true);
  // Bits per sample
  view.setUint16(34, bitsPerSample, true);
  // Data chunk identifier
  view.setUint32(36, 0x64617461, false); // "data"
  // Data chunk length
  view.setUint32(40, dataSize, true);

  // Combine header and PCM data
  const wavFile = new Uint8Array(header.byteLength + pcmData.length);
  wavFile.set(new Uint8Array(header), 0);
  wavFile.set(pcmData, header.byteLength);

  return wavFile;
}

// Number to words conversion helper
function numberToWords(num: number): string {
  const ones = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'];
  const teens = ['ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
  const tens = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
  const thousands = ['', 'thousand', 'million', 'billion'];

  if (num === 0) return 'zero';
  if (num < 0) return 'negative ' + numberToWords(-num);

  let words = '';
  let thousandCounter = 0;

  while (num > 0) {
    const chunk = num % 1000;
    if (chunk !== 0) {
      let chunkWords = '';

      const hundreds = Math.floor(chunk / 100);
      if (hundreds > 0) {
        chunkWords += ones[hundreds] + ' hundred ';
      }

      const remainder = chunk % 100;
      if (remainder >= 10 && remainder < 20) {
        chunkWords += teens[remainder - 10];
      } else {
        const tensDigit = Math.floor(remainder / 10);
        const onesDigit = remainder % 10;
        if (tensDigit > 0) {
          chunkWords += tens[tensDigit];
          if (onesDigit > 0) chunkWords += ' ';
        }
        if (onesDigit > 0) {
          chunkWords += ones[onesDigit];
        }
      }

      if (thousands[thousandCounter]) {
        chunkWords += ' ' + thousands[thousandCounter];
      }

      words = chunkWords.trim() + ' ' + words;
    }

    num = Math.floor(num / 1000);
    thousandCounter++;
  }

  return words.trim();
}

// Normalize text for TTS - convert numbers to words for better pronunciation
function normalizeForTTS(text: string): string {
  // Handle currency amounts (e.g., $695.95 -> "six hundred ninety five dollars and ninety five cents")
  text = text.replace(/\$(\d+)\.(\d{2})/g, (match, dollars, cents) => {
    const dollarNum = parseInt(dollars);
    const centNum = parseInt(cents);

    let result = numberToWords(dollarNum) + ' dollar';
    if (dollarNum !== 1) result += 's';

    if (centNum > 0) {
      result += ' and ' + numberToWords(centNum) + ' cent';
      if (centNum !== 1) result += 's';
    }

    return result;
  });

  // Handle currency without cents (e.g., $695 or $3,000 -> "six hundred ninety five dollars" or "three thousand dollars")
  text = text.replace(/\$(\d{1,3}(?:,\d{3})*)(?!\.\d)/g, (match, dollars) => {
    const dollarNum = parseInt(dollars.replace(/,/g, ''));  // Strip commas before parsing
    let result = numberToWords(dollarNum) + ' dollar';
    if (dollarNum !== 1) result += 's';
    return result;
  });

  // Handle percentages (e.g., 25% -> "twenty five percent")
  text = text.replace(/(\d+)%/g, (match, num) => {
    return numberToWords(parseInt(num)) + ' percent';
  });

  // Handle standalone numbers (but preserve decimals in context)
  text = text.replace(/\b(\d{1,3})\b/g, (match, num) => {
    const numVal = parseInt(num);
    if (numVal <= 10 || match.startsWith('#')) {
      return match;
    }
    return numberToWords(numVal);
  });

  return text;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const { headers } = req;
  const upgradeHeader = headers.get("upgrade") || "";

  if (upgradeHeader.toLowerCase() !== "websocket") {
    return new Response("Expected WebSocket connection", { status: 400 });
  }

  console.log(`[WebSocket] New connection for NLC`);

  const { socket, response } = Deno.upgradeWebSocket(req);
  const sessionId = crypto.randomUUID();

  socket.onopen = async () => {
    console.log(`[WebSocket] Connected - Session: ${sessionId}`);

    const session: VoiceSession = {
      conversationId: null,
      transcript: [],
      startTime: Date.now(),
      conversationHistory: [],
      assemblyaiConnection: null,
      cartesiaConnection: null,
      currentContextId: null,
      audioChunkIndex: 0,
      isProcessing: false,
    };

    sessions.set(sessionId, session);

    // Initialize AssemblyAI connection
    const assemblyaiReady = await initializeAssemblyAI(sessionId, socket);

    if (!assemblyaiReady) {
      console.error('[WebSocket] Failed to initialize AssemblyAI');
      socket.send(JSON.stringify({
        type: 'error',
        message: 'Failed to initialize voice recognition'
      }));
      socket.close();
      return;
    }

    // Initialize Cartesia WebSocket connection
    const cartesiaReady = await initializeCartesia(sessionId, socket);

    if (!cartesiaReady) {
      console.error('[WebSocket] Failed to initialize Cartesia');
      socket.send(JSON.stringify({
        type: 'error',
        message: 'Failed to initialize text-to-speech'
      }));
      socket.close();
      return;
    }

    socket.send(JSON.stringify({
      type: 'connection.established',
      sessionId,
      message: 'NLC Voice AI ready'
    }));

    console.log(`[WebSocket] Session initialized: ${sessionId}`);
  };

  socket.onmessage = async (event) => {
    try {
      const session = sessions.get(sessionId);
      if (!session) {
        console.error('[WebSocket] Session not found:', sessionId);
        return;
      }

      const data = JSON.parse(event.data);

      switch (data.type) {
        case 'audio.chunk':
          await handleAudioChunk(sessionId, data.audio, socket);
          break;
        case 'session.end':
          await handleEndSession(sessionId, socket);
          break;
        default:
          console.warn('[WebSocket] Unknown message type:', data.type);
      }
    } catch (error) {
      console.error('[WebSocket] Message handling error:', error);
      socket.send(JSON.stringify({
        type: 'error',
        message: error instanceof Error ? error.message : 'Unknown error'
      }));
    }
  };

  socket.onclose = async () => {
    console.log(`[WebSocket] Connection closed - Session: ${sessionId}`);
    await saveSessionToDatabase(sessionId);

    const session = sessions.get(sessionId);
    if (session?.assemblyaiConnection) {
      session.assemblyaiConnection.close();
    }
    if (session?.cartesiaConnection) {
      session.cartesiaConnection.close();
    }
    sessions.delete(sessionId);
  };

  socket.onerror = (error) => {
    console.error('[WebSocket] Error:', error);
  };

  return response;
});

async function initializeAssemblyAI(sessionId: string, clientSocket: WebSocket): Promise<boolean> {
  const session = sessions.get(sessionId);
  if (!session) return false;

  const ASSEMBLYAI_API_KEY = Deno.env.get('ASSEMBLYAI_API_KEY');
  if (!ASSEMBLYAI_API_KEY) {
    console.error('[AssemblyAI] API key not configured');
    return false;
  }

  try {
    const params = new URLSearchParams({
      sample_rate: '24000', // Match our client's audio format
      format_turns: 'true',
      end_of_turn_confidence_threshold: '0.7',
      min_end_of_turn_silence_when_confident: '160',
      max_turn_silence: '1000',
      inactivity_timeout: '120', // 2 minutes of inactivity before session closes
      token: ASSEMBLYAI_API_KEY // Pass API key as query param for Deno compatibility
    });

    const assemblyaiWs = new WebSocket(
      `wss://streaming.assemblyai.com/v3/ws?${params}`
    );

    const connectionPromise = new Promise<boolean>((resolve) => {
      const timeout = setTimeout(() => {
        console.error('[AssemblyAI] Connection timeout');
        resolve(false);
      }, 10000);

      assemblyaiWs.onopen = () => {
        clearTimeout(timeout);
        console.log('[AssemblyAI] Connected');
        session.assemblyaiConnection = assemblyaiWs;
        resolve(true);
      };

      assemblyaiWs.onerror = (error) => {
        clearTimeout(timeout);
        console.error('[AssemblyAI] Connection error:', error);
        resolve(false);
      };
    });

    assemblyaiWs.onmessage = async (event) => {
      try {
        const data = JSON.parse(event.data);
        const msgType = data.type;

        if (msgType === 'Begin') {
          console.log(`[AssemblyAI] Session began: ID=${data.id}`);
        } else if (msgType === 'Turn') {
          const transcript = data.transcript || '';
          const isFormatted = data.turn_is_formatted;

          if (transcript && transcript.trim()) {
            console.log(`[AssemblyAI] ${isFormatted ? 'Formatted' : 'Partial'}: ${transcript}`);

            clientSocket.send(JSON.stringify({
              type: 'transcript.update',
              text: transcript,
              isFinal: isFormatted
            }));

            if (isFormatted && !session.isProcessing) {
              session.isProcessing = true;

              session.transcript.push({
                role: 'customer',
                content: transcript,
                timestamp: new Date().toISOString()
              });

              await processWithGPT(sessionId, transcript, clientSocket);
            }
          }
        } else if (msgType === 'Termination') {
          console.log(`[AssemblyAI] Session terminated: Audio=${data.audio_duration_seconds}s, Session=${data.session_duration_seconds}s`);
        }
      } catch (error) {
        console.error('[AssemblyAI] Message parsing error:', error);
      }
    };

    assemblyaiWs.onclose = (event) => {
      console.log(`[AssemblyAI] Connection closed: code=${event.code}, reason=${event.reason}`);
    };

    return await connectionPromise;
  } catch (error) {
    console.error('[AssemblyAI] Connection error:', error);
    return false;
  }
}

async function initializeCartesia(sessionId: string, clientSocket: WebSocket): Promise<boolean> {
  const session = sessions.get(sessionId);
  if (!session) return false;

  const CARTESIA_API_KEY = Deno.env.get('CARTESIA_API_KEY');
  if (!CARTESIA_API_KEY) {
    console.error('[Cartesia] API key not configured');
    return false;
  }

  try {
    const cartesiaWs = new WebSocket(
      `wss://api.cartesia.ai/tts/websocket?api_key=${CARTESIA_API_KEY}&cartesia_version=2024-06-10`
    );

    const connectionPromise = new Promise<boolean>((resolve) => {
      const timeout = setTimeout(() => {
        console.error('[Cartesia] Connection timeout');
        resolve(false);
      }, 10000);

      cartesiaWs.onopen = () => {
        clearTimeout(timeout);
        console.log('[Cartesia] WebSocket connected');
        session.cartesiaConnection = cartesiaWs;
        resolve(true);
      };

      cartesiaWs.onerror = (error) => {
        clearTimeout(timeout);
        console.error('[Cartesia] Connection error:', error);
        resolve(false);
      };
    });

    cartesiaWs.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data.type === 'chunk') {
          // Got audio chunk from Cartesia (raw PCM data)
          const pcmBase64 = data.data; // Base64 encoded PCM

          // Decode base64 to raw PCM bytes
          const pcmData = Uint8Array.from(atob(pcmBase64), c => c.charCodeAt(0));

          // Convert PCM to WAV (add WAV header so browsers can play it)
          const wavData = pcmToWav(pcmData, 22050, 1, 16);

          // Re-encode to base64
          let binary = '';
          for (let i = 0; i < wavData.length; i++) {
            binary += String.fromCharCode(wavData[i]);
          }
          const wavBase64 = btoa(binary);

          clientSocket.send(JSON.stringify({
            type: 'audio.chunk',
            audio: wavBase64,
            format: 'wav',
            chunk_index: session.audioChunkIndex++
          }));

          console.log(`[Cartesia] Audio chunk #${session.audioChunkIndex - 1} sent (WAV, ${wavData.length} bytes)`);
        } else if (data.type === 'done') {
          // Context complete
          console.log(`[Cartesia] Context ${data.context_id} done`);

          clientSocket.send(JSON.stringify({
            type: 'audio.complete',
            total_chunks: session.audioChunkIndex
          }));

          // Reset for next turn
          session.currentContextId = null;
          session.audioChunkIndex = 0;
        } else if (data.type === 'error') {
          console.error('[Cartesia] Error:', data.error);
        }
      } catch (error) {
        console.error('[Cartesia] Message parsing error:', error);
      }
    };

    cartesiaWs.onclose = () => {
      console.log('[Cartesia] Connection closed');
    };

    return await connectionPromise;
  } catch (error) {
    console.error('[Cartesia] Connection error:', error);
    return false;
  }
}

async function handleAudioChunk(sessionId: string, audioBase64: string, socket: WebSocket) {
  const session = sessions.get(sessionId);
  if (!session || !session.assemblyaiConnection) return;

  try {
    const audioData = Uint8Array.from(atob(audioBase64), c => c.charCodeAt(0));

    if (session.assemblyaiConnection.readyState === WebSocket.OPEN) {
      session.assemblyaiConnection.send(audioData);
    }
  } catch (error) {
    console.error('[Audio] Error processing chunk:', error);
  }
}

async function processWithGPT(sessionId: string, userInput: string, socket: WebSocket) {
  const session = sessions.get(sessionId);
  if (!session) return;

  const GROQ_API_KEY = Deno.env.get('GROQ_API_KEY');
  if (!GROQ_API_KEY) {
    console.error('[GPT-OSS] Groq API key not configured');
    session.isProcessing = false;
    return;
  }

  const systemPrompt = `You are a friendly AI assistant for No Limit Creatives (NLC), a design and creative agency. You're having a natural voice conversation with a potential client.

CONVERSATION STYLE:
- Speak naturally and professionally
- Keep responses under 40 words for voice clarity
- Be warm, enthusiastic, and helpful
- Focus on NLC's creative services: branding, web design, graphic design, marketing

SERVICES NLC OFFERS:
- Brand identity & logo design
- Website design & development
- Graphic design (print & digital)
- Marketing materials & campaigns
- Social media content creation
- Creative consulting

VOCAL PERFORMANCE (USE THESE TAGS TO ADD EMOTION):
You have full control over your voice using these tags:

EMOTIONS - Use <emotion value="X" /> before sentences:
- excited: When enthusiastic or showing high energy
- euphoric: DEFAULT for general positive responses, satisfaction, and reassurance (use this most often!)
- sad: When sympathetic or apologetic
- angry: When firm or assertive (use rarely!)
- scared: When concerned or worried
- neutral: ONLY when being strictly informational or serious

LAUGHTER - Use [laughter] when genuinely funny or lighthearted

PAUSES - Use <break time="500ms"/> for emphasis or dramatic effect

SPEED - Use <speed ratio="0.8"/> to slow down for important details

VOLUME - Use <volume ratio="1.2"/> to emphasize key points

EXAMPLES:
✗ Bad: "That's great! We can definitely help with that."
✓ Good: "<emotion value="excited" /> That's fantastic! [laughter] <break time="300ms"/> <emotion value="euphoric" /> We can absolutely help with that."

✗ Bad: "I'm sorry to hear you're having issues."
✓ Good: "<emotion value="sad" /> I'm so sorry to hear that. <break time="300ms"/> <emotion value="euphoric" /> Let's fix this together."

✗ Bad: "Our prices start at five hundred dollars."
✓ Good: "<speed ratio="0.8"/> Our prices start at five hundred dollars. <break time="200ms"/> <emotion value="euphoric" /> Great value for the quality you'll get!"

IMPORTANT:
- Use "euphoric" as your DEFAULT emotion for most responses - it sounds warm and engaging!
- Only use "neutral" when being strictly informational
- Use tags naturally, don't overdo it
- Match emotion to context
- If you include URLs, wrap them in [URL: link] format so they aren't spoken aloud`;


  try {
    const messages = [
      { role: 'system', content: systemPrompt },
      ...session.conversationHistory.slice(-10),
      { role: 'user', content: userInput }
    ];

    console.log('[GPT-OSS] Sending streaming request to Groq...');

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
        stream: true
      })
    });

    if (!response.ok) {
      throw new Error(`Groq API error: ${response.status}`);
    }

    // STREAMING MODE - Stream text chunks to Cartesia WebSocket as they arrive
    const reader = response.body?.getReader();
    const decoder = new TextDecoder();
    let fullResponse = '';
    let textBuffer = '';

    // Create new context for this response
    const contextId = crypto.randomUUID();
    session.currentContextId = contextId;
    session.audioChunkIndex = 0;

    if (reader) {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n').filter(line => line.trim() !== '');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') continue;

            try {
              const parsed = JSON.parse(data);
              const delta = parsed.choices[0]?.delta;

              if (delta?.content) {
                const chunkText = delta.content;
                fullResponse += chunkText;
                textBuffer += chunkText;

                // Check for sentence endings to send to Cartesia
                const sentenceEndPattern = /[.!?]\s/;
                const hasSentenceEnding = sentenceEndPattern.test(textBuffer);

                if (hasSentenceEnding) {
                  let lastEndingPos = -1;

                  for (let i = 0; i < textBuffer.length - 1; i++) {
                    const char = textBuffer[i];
                    const nextChar = textBuffer[i + 1];

                    if ((char === '.' || char === '!' || char === '?') && /\s/.test(nextChar)) {
                      lastEndingPos = i;
                    }
                  }

                  if (lastEndingPos !== -1) {
                    const sentenceChunk = textBuffer.substring(0, lastEndingPos + 1).trim();
                    const remainingText = textBuffer.substring(lastEndingPos + 1).trim();

                    if (sentenceChunk) {
                      console.log(`[GPT-Stream] Sentence: "${sentenceChunk}"`);

                      // Send text chunk to client
                      socket.send(JSON.stringify({
                        type: 'text.chunk',
                        text: sentenceChunk
                      }));

                      // Stream to Cartesia WebSocket (with continue flag)
                      await streamToCartesia(sessionId, sentenceChunk, contextId, true);

                      textBuffer = remainingText;
                    }
                  }
                }
              }
            } catch (e) {
              // Skip invalid JSON
            }
          }
        }
      }
    }

    // Send any remaining text
    if (textBuffer.trim()) {
      console.log(`[GPT-Stream] Final chunk: "${textBuffer}"`);

      socket.send(JSON.stringify({
        type: 'text.chunk',
        text: textBuffer.trim()
      }));

      // Final chunk to Cartesia (continue: false to signal end)
      await streamToCartesia(sessionId, textBuffer.trim(), contextId, false);
    }
    // Note: If no remaining text, don't send anything - context will auto-close

    const aiResponse = fullResponse || 'I apologize, I didn\'t catch that.';

    socket.send(JSON.stringify({
      type: 'text.complete',
      text: aiResponse
    }));

    // Update conversation history
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
    socket.send(JSON.stringify({
      type: 'error',
      message: 'Failed to process request'
    }));
  } finally {
    session.isProcessing = false;
  }
}

async function streamToCartesia(sessionId: string, text: string, contextId: string, continueFlag: boolean) {
  const session = sessions.get(sessionId);
  if (!session || !session.cartesiaConnection) {
    console.error('[Cartesia] No connection available');
    return;
  }

  // Normalize text
  let speechText = text.replace(/\[URL:.*?\]/gi, '');
  speechText = speechText.replace(/https?:\/\/[^\s]+/gi, '');
  speechText = speechText.replace(/\s+/g, ' ').trim();
  speechText = normalizeForTTS(speechText);

  // Check if text is empty or only punctuation after normalization
  const hasActualText = /[a-zA-Z0-9]/.test(speechText);

  if (!hasActualText) {
    console.log('[Cartesia] Empty or punctuation-only text after normalization, skipping');
    return;
  }

  const message = {
    model_id: 'sonic-3',
    voice: {
      mode: 'id',
      id: 'f786b574-daa5-4673-aa0c-cbe3e8534c02' // English voice
    },
    transcript: speechText,
    context_id: contextId,
    continue: continueFlag,
    output_format: {
      container: 'raw',
      encoding: 'pcm_s16le', // 16-bit PCM (easier to convert to WAV)
      sample_rate: 22050 // Lower sample rate for faster streaming
    },
    language: 'en', // English
    generation_config: {
      volume: 1.5 // Volume boost (0.5-2.0)
    }
  };

  if (session.cartesiaConnection.readyState === WebSocket.OPEN) {
    session.cartesiaConnection.send(JSON.stringify(message));
    console.log(`[Cartesia] Sent chunk (continue=${continueFlag}): "${speechText.substring(0, 50)}..."`);
  } else {
    console.error('[Cartesia] WebSocket not open');
  }
}

async function generateSpeechChunk(sessionId: string, text: string, socket: WebSocket, chunkIndex: number) {
  const session = sessions.get(sessionId);
  if (!session) return;

  const CARTESIA_API_KEY = Deno.env.get('CARTESIA_API_KEY');
  if (!CARTESIA_API_KEY) {
    console.error('[Cartesia] API key not configured');
    return;
  }

  // Voice ID - Cartesia default English voice
  const voiceId = '694f9389-aac1-45b6-b726-9d9369183238';

  // Strip URLs and normalize numbers
  let speechText = text.replace(/\[URL:.*?\]/gi, '');
  speechText = speechText.replace(/https?:\/\/[^\s]+/gi, '');
  speechText = speechText.replace(/\s+/g, ' ').trim();
  speechText = normalizeForTTS(speechText);

  if (!speechText) return;

  try {
    const startTime = Date.now();
    console.log(`[Cartesia-Chunk #${chunkIndex}] Generating TTS for: "${speechText.substring(0, 50)}..."`);

    const response = await fetch(
      'https://api.cartesia.ai/tts/bytes',
      {
        method: 'POST',
        headers: {
          'Cartesia-Version': '2025-04-16',
          'X-API-Key': CARTESIA_API_KEY,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          transcript: speechText,
          model_id: 'sonic-3',
          voice: {
            mode: 'id',
            id: voiceId
          },
          output_format: {
            container: 'mp3',
            encoding: 'mp3',
            sample_rate: 44100
          },
          language: 'en'
        })
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Cartesia] API error:', response.status, errorText);
      return;
    }

    const audioArrayBuffer = await response.arrayBuffer();
    const bytes = new Uint8Array(audioArrayBuffer);

    // Convert to base64
    let binary = '';
    const chunkSize = 0x8000;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      const chunk = bytes.subarray(i, Math.min(i + chunkSize, bytes.length));
      binary += String.fromCharCode.apply(null, Array.from(chunk));
    }
    const audioBase64 = btoa(binary);

    socket.send(JSON.stringify({
      type: 'audio.chunk',
      audio: audioBase64,
      format: 'mp3',
      chunk_index: chunkIndex
    }));

    console.log(`[Cartesia-Chunk #${chunkIndex}] ✅ Sent audio (${bytes.length} bytes) in ${Date.now() - startTime}ms`);
  } catch (error) {
    console.error(`[Cartesia-Chunk #${chunkIndex}] Error:`, error);
  }
}

async function handleEndSession(sessionId: string, socket: WebSocket) {
  console.log('[Session] Ending:', sessionId);

  const session = sessions.get(sessionId);
  if (session?.assemblyaiConnection) {
    session.assemblyaiConnection.close();
  }

  socket.send(JSON.stringify({
    type: 'session.ended',
    message: 'Session ended'
  }));

  socket.close();
}

async function saveSessionToDatabase(sessionId: string) {
  const session = sessions.get(sessionId);
  if (!session || session.transcript.length === 0) return;

  const supabaseClient = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  try {
    const duration = Math.floor((Date.now() - session.startTime) / 1000);
    const transcriptText = session.transcript.map(t => t.content).join(' ');

    await supabaseClient
      .from('calls')
      .insert({
        phone_number: 'web-customer',
        duration,
        transcript: transcriptText,
        sentiment: calculateSentiment(transcriptText),
        topics: [extractTopic(transcriptText)]
      });

    console.log('[Database] Session saved:', sessionId);
  } catch (error) {
    console.error('[Database] Error:', error);
  }
}

function calculateSentiment(text: string): string {
  const positive = ['great', 'good', 'thanks', 'thank', 'excellent', 'happy', 'love'];
  const negative = ['bad', 'poor', 'terrible', 'angry', 'frustrated'];

  const lower = text.toLowerCase();
  const positiveCount = positive.filter(w => lower.includes(w)).length;
  const negativeCount = negative.filter(w => lower.includes(w)).length;

  if (positiveCount > negativeCount) return 'positive';
  if (negativeCount > positiveCount) return 'negative';
  return 'neutral';
}

function extractTopic(text: string): string {
  const topics = {
    'design': ['design', 'branding', 'logo', 'creative'],
    'web': ['website', 'web', 'development', 'site'],
    'marketing': ['marketing', 'campaign', 'social'],
    'pricing': ['price', 'cost', 'quote', 'budget'],
  };

  const lower = text.toLowerCase();
  let maxCount = 0;
  let topic = 'general';

  for (const [key, keywords] of Object.entries(topics)) {
    const count = keywords.filter(k => lower.includes(k)).length;
    if (count > maxCount) {
      maxCount = count;
      topic = key;
    }
  }

  return topic;
}
