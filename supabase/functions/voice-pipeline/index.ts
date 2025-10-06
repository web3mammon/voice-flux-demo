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

    console.log('Processing audio chunk, conversation history length:', conversationHistory?.length || 0);

    // Step 1: Transcribe with Deepgram Flux
    const formData = new FormData();
    const audioBlob = new Blob([Uint8Array.from(atob(audio), c => c.charCodeAt(0))], { 
      type: 'audio/webm' 
    });
    formData.append('file', audioBlob);

    const transcribeResponse = await fetch(
      'https://api.deepgram.com/v1/listen?model=flux&smart_format=true&punctuate=true&vad_events=true',
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
        JSON.stringify({ userText: '', aiText: '', audioContent: null }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Transcribed text:', userText);

    // Step 2: Get GPT response (streaming)
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
        model: 'gpt-4o-mini',
        messages,
        temperature: 0.7,
        max_tokens: 150,
      }),
    });

    if (!gptResponse.ok) {
      const error = await gptResponse.text();
      console.error('OpenAI error:', error);
      throw new Error(`OpenAI API error: ${error}`);
    }

    const gptData = await gptResponse.json();
    const aiText = gptData.choices?.[0]?.message?.content || '';

    console.log('GPT response:', aiText);

    // Step 3: Convert to speech with ElevenLabs
    const ttsResponse = await fetch(
      'https://api.elevenlabs.io/v1/text-to-speech/21m00Tcm4TlvDq8ikWAM/stream',
      {
        method: 'POST',
        headers: {
          'xi-api-key': ELEVENLABS_API_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: aiText,
          model_id: 'eleven_turbo_v2_5',
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
          }
        }),
      }
    );

    if (!ttsResponse.ok) {
      const error = await ttsResponse.text();
      console.error('ElevenLabs error:', error);
      throw new Error(`ElevenLabs API error: ${error}`);
    }

    const audioArrayBuffer = await ttsResponse.arrayBuffer();
    const audioBase64 = btoa(String.fromCharCode(...new Uint8Array(audioArrayBuffer)));

    console.log('TTS generated, audio size:', audioBase64.length);

    return new Response(
      JSON.stringify({ 
        userText, 
        aiText, 
        audioContent: audioBase64 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in voice-pipeline:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
