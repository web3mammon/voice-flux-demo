import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

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
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!DEEPGRAM_API_KEY || !OPENAI_API_KEY || !ELEVENLABS_API_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('Missing required API keys');
    }

    // Initialize Supabase client
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Fetch active AI config
    const { data: config, error: configError } = await supabase
      .from('ai_config')
      .select('*')
      .eq('is_active', true)
      .maybeSingle();

    if (configError) {
      console.error('Error fetching config:', configError);
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
      'https://api.deepgram.com/v1/listen?model=nova-3&smart_format=true&punctuate=true&endpointing=300',
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
              content: config?.system_prompt || `You are Jennifer, NLC's friendly AI assistant. You help clients understand NLC's design services and capabilities.

ABOUT NLC (NoLimit Creatives):
NLC is a premium unlimited design subscription service that delivers professional design work on demand. They serve e-commerce brands, marketing agencies, real estate companies, and enterprises.

CORE SERVICES:
- Social Media Ads: Scroll-stopping ads that convert followers
- Website Design: Custom websites and landing pages
- Logos & Branding: Distinctive designs for brand recognition
- Motion Graphics: Transform static designs into captivating videos
- Presentations: Transform complex ideas into compelling decks
- Email Designs: Revenue-driving emails that convert subscribers
- Amazon Content: Premium A+ content, storefronts, and product listings
- Video Editing: Both short-form (social media) and long-form content
- Illustrations: Custom illustrations for brand storytelling
- Packaging: Custom packaging designs
- Print Design: Business cards to billboards

DESIGN PLANS:
1. Digital Ads Plan: All social media graphic and video ads delivered on time
2. Ecom Plan: All graphics & videos needed to run successful e-commerce brands
3. Marketing Plan: Scale agencies with stunning designs without increasing overhead
4. Full Stack Plan: Website builds plus unlimited design types with unlimited revisions

SPECIAL SERVICES:
- White Glove Concierge Design: Premium add-on service for high-touch support
- Unlimited revisions on Full Stack plan
- Fast turnaround times
- Dedicated design team

INDUSTRIES SERVED:
- E-commerce brands
- Marketing agencies
- Real estate
- Enterprise companies

YOUR ROLE:
- Be warm, professional, and helpful
- Keep responses conversational and concise (1-2 sentences for voice)
- Help clients understand which services and plans fit their needs
- Explain NLC's value proposition: unlimited designs, fast delivery, professional quality
- When asked about pricing or specific plan details, acknowledge you can connect them with the team for exact quotes
- If asked about capabilities, confidently explain what NLC can deliver

Keep all responses natural for voice conversation. Be enthusiastic about NLC's capabilities while being genuinely helpful.` 
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

                    // Send text delta
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify({ 
                      type: 'text_delta', 
                      text: content 
                    })}\n\n`));
                  }
                } catch (e) {
                  console.error('Parse error:', e);
                }
              }
            }
          }

          // Send COMPLETE text to ElevenLabs once
          if (fullText.trim()) {
            console.log('Sending complete response to ElevenLabs:', fullText);
            const audioChunk = await generateAudio(fullText, ELEVENLABS_API_KEY, config);
            if (audioChunk) {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ 
                type: 'audio_chunk', 
                audio: audioChunk 
              })}\n\n`));
            }
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

async function generateAudio(text: string, apiKey: string, config: any): Promise<string | null> {
  try {
    // Map voice names to ElevenLabs voice IDs
    const voiceMap: Record<string, string> = {
      'Aria': '9BWtsMINqrJLrRacOk9x',
      'Roger': 'CwhRBWXzGAHq8TQ4Fs17',
      'Sarah': 'EXAVITQu4vr4xnSDxMaL',
      'Laura': 'FGY2WhTYpPnrIDTdsKH5',
      'Charlie': 'IKne3meq5aSn9XLyUdCD',
      'George': 'JBFqnCBsd6RMkjVDRZzb',
      'Callum': 'N2lVS1w4EtoT3dr4eOWO',
      'River': 'SAz9YHcvj6GT2YYXdXww',
      'Liam': 'TX3LPaxmHKxFdv7VOQHJ',
      'Charlotte': 'XB0fDUnXU5powFXDhCwa',
    };

    const voiceId = voiceMap[config?.voice_id || 'Aria'] || '9BWtsMINqrJLrRacOk9x';
    
    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
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
            stability: config?.voice_stability || 0.5,
            similarity_boost: config?.voice_clarity || 0.75,
            speed: config?.voice_speed || 1.0,
          },
        }),
      }
    );

    if (!response.ok) {
      console.error('ElevenLabs error:', await response.text());
      return null;
    }

    const audioArrayBuffer = await response.arrayBuffer();
    const bytes = new Uint8Array(audioArrayBuffer);
    
    // Convert to base64 in chunks to avoid stack overflow
    let binary = '';
    const chunkSize = 0x8000; // 32KB chunks
    for (let i = 0; i < bytes.length; i += chunkSize) {
      const chunk = bytes.subarray(i, Math.min(i + chunkSize, bytes.length));
      binary += String.fromCharCode.apply(null, Array.from(chunk));
    }
    return btoa(binary);
  } catch (error) {
    console.error('Error generating audio:', error);
    return null;
  }
}
