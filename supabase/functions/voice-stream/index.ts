import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const DEEPGRAM_API_KEY = Deno.env.get('DEEPGRAM_API_KEY');
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    const ELEVENLABS_API_KEY = Deno.env.get('ELEVENLABS_API_KEY');

    if (!DEEPGRAM_API_KEY || !OPENAI_API_KEY || !ELEVENLABS_API_KEY) {
      throw new Error('Missing required API keys');
    }

    const { audio, conversationHistory } = await req.json();

    console.log('Starting streaming pipeline...');

    // Step 1: Transcribe with Deepgram Flux
    const formData = new FormData();
    const audioBlob = new Blob([Uint8Array.from(atob(audio), c => c.charCodeAt(0))], { 
      type: 'audio/webm' 
    });
    formData.append('file', audioBlob);

    const transcribeResponse = await fetch(
      'https://api.deepgram.com/v1/listen?model=nova-3&smart_format=true&punctuate=true',
      {
        method: 'POST',
        headers: {
          'Authorization': `Token ${DEEPGRAM_API_KEY}`,
        },
        body: formData,
      }
    );

    if (!transcribeResponse.ok) {
      const error = await transcribeResponse.text();
      console.error('Deepgram error:', error);
      throw new Error(`Deepgram API error: ${error}`);
    }

    const transcription = await transcribeResponse.json();
    const userText = transcription.results?.channels?.[0]?.alternatives?.[0]?.transcript || '';

    if (!userText.trim()) {
      return new Response(
        JSON.stringify({ type: 'empty' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Transcribed:', userText);

    // Step 2: Stream from GPT and chunk to ElevenLabs
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          // Send user text first
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ 
            type: 'user_text', 
            text: userText 
          })}\n\n`));

          const messages = [
            { 
              role: 'system', 
              content: 'You are a helpful, friendly AI voice assistant. Keep responses concise and natural for voice conversation. Respond in 1-2 sentences unless more detail is specifically requested.' 
            },
            ...(conversationHistory || []),
            { role: 'user', content: userText }
          ];

          const gptResponse = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${OPENAI_API_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: 'gpt-4.1-mini-2025-04-14',
              messages,
              temperature: 0.7,
              max_completion_tokens: 150,
              stream: true,
            }),
          });

          if (!gptResponse.ok) {
            throw new Error(`GPT error: ${await gptResponse.text()}`);
          }

          const reader = gptResponse.body?.getReader();
          if (!reader) throw new Error('No response body');

          const decoder = new TextDecoder();
          let buffer = '';
          let fullText = '';
          let chunkBuffer = '';
          const CHUNK_SIZE = 20; // tokens per chunk

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
              if (line.startsWith('data: ')) {
                const data = line.slice(6);
                if (data === '[DONE]') continue;

                try {
                  const parsed = JSON.parse(data);
                  const content = parsed.choices?.[0]?.delta?.content;
                  
                  if (content) {
                    fullText += content;
                    chunkBuffer += content;

                    // Send text delta
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify({ 
                      type: 'text_delta', 
                      text: content 
                    })}\n\n`));

                    // Check if we should send to ElevenLabs
                    const words = chunkBuffer.split(/\s+/).filter(w => w.length > 0);
                    if (words.length >= CHUNK_SIZE) {
                      console.log('Sending chunk to ElevenLabs:', chunkBuffer);
                      
                      // Stream audio from ElevenLabs directly
                      await streamAudioFromElevenLabs(chunkBuffer, ELEVENLABS_API_KEY, controller, encoder);
                      
                      chunkBuffer = '';
                    }
                  }
                } catch (e) {
                  console.error('Parse error:', e);
                }
              }
            }
          }

          // CRITICAL: Send remaining chunk (last chunk, regardless of size)
          if (chunkBuffer.trim()) {
            console.log('Sending final chunk to ElevenLabs:', chunkBuffer);
            await streamAudioFromElevenLabs(chunkBuffer, ELEVENLABS_API_KEY, controller, encoder);
          }

          // Send completion
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ 
            type: 'complete',
            fullText 
          })}\n\n`));

          controller.close();
        } catch (error) {
          console.error('Stream error:', error);
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ 
            type: 'error', 
            error: error instanceof Error ? error.message : 'Unknown error' 
          })}\n\n`));
          controller.close();
        }
      }
    });

    return new Response(stream, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });

  } catch (error) {
    console.error('Error in voice-stream:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});

async function streamAudioFromElevenLabs(
  text: string, 
  apiKey: string, 
  controller: ReadableStreamDefaultController,
  encoder: TextEncoder
): Promise<void> {
  try {
    const response = await fetch(
      'https://api.elevenlabs.io/v1/text-to-speech/21m00Tcm4TlvDq8ikWAM/stream',
      {
        method: 'POST',
        headers: {
          'xi-api-key': apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text,
          model_id: 'eleven_flash_v2_5',
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
          },
          optimize_streaming_latency: 3,
        }),
      }
    );

    if (!response.ok) {
      console.error('ElevenLabs error:', await response.text());
      return;
    }

    const reader = response.body?.getReader();
    if (!reader) {
      console.error('No response body from ElevenLabs');
      return;
    }

    // Stream audio chunks as they arrive from ElevenLabs
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      // Convert chunk to base64 in chunks to avoid stack overflow
      let binary = '';
      const chunkSize = 0x8000; // 32KB chunks
      for (let i = 0; i < value.length; i += chunkSize) {
        const chunk = value.subarray(i, Math.min(i + chunkSize, value.length));
        binary += String.fromCharCode.apply(null, Array.from(chunk));
      }
      const base64Audio = btoa(binary);

      // Send audio chunk immediately to client
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ 
        type: 'audio_chunk', 
        audio: base64Audio 
      })}\n\n`));
    }
  } catch (error) {
    console.error('Error streaming audio from ElevenLabs:', error);
  }
}
