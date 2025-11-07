import { AudioPlayer } from './audioUtils';

export class VoiceWebSocketService {
  private ws: WebSocket | null = null;
  private audioPlayer: AudioPlayer;
  private onTranscriptUpdate?: (text: string, isFinal: boolean) => void;
  private onTextChunk?: (text: string) => void;
  private onAudioChunk?: (audio: string, index: number) => void;
  private onComplete?: (text: string) => void;
  private onError?: (error: string) => void;

  constructor() {
    this.audioPlayer = new AudioPlayer();
  }

  connect(supabaseUrl: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const wsUrl = `${supabaseUrl.replace('https://', 'wss://')}/functions/v1/voice-websocket`;
      console.log('[WebSocket] Connecting to:', wsUrl);

      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        console.log('[WebSocket] Connected');
        resolve();
      };

      this.ws.onmessage = (event) => {
        this.handleMessage(event);
      };

      this.ws.onerror = (error) => {
        console.error('[WebSocket] Error:', error);
        this.onError?.('Connection error');
        reject(error);
      };

      this.ws.onclose = () => {
        console.log('[WebSocket] Closed');
      };
    });
  }

  private handleMessage(event: MessageEvent) {
    try {
      const data = JSON.parse(event.data);
      console.log('[WebSocket] Received:', data.type);

      switch (data.type) {
        case 'connection.established':
          console.log('[WebSocket] Session established:', data.sessionId);
          break;

        case 'transcript.update':
          this.onTranscriptUpdate?.(data.text, data.isFinal);
          break;

        case 'transcript.final':
          // Batch transcription result from AssemblyAI
          console.log('[WebSocket] Final transcript received:', data.text);
          this.onTranscriptUpdate?.(data.text, true);
          break;

        case 'text.chunk':
          this.onTextChunk?.(data.text);
          break;

        case 'audio.chunk':
          // Play audio through AudioPlayer (buffers and plays in order)
          this.audioPlayer.addToQueue(data.audio, data.chunk_index);
          // Also notify callback if set
          this.onAudioChunk?.(data.audio, data.chunk_index);
          break;

        case 'text.complete':
          this.onComplete?.(data.text);
          break;

        case 'audio.complete':
          console.log(`[WebSocket] Audio complete: ${data.total_chunks} chunks`);
          // No reset here - AudioPlayer auto-resets when chunk #0 of next response arrives
          break;

        case 'interrupt.acknowledged':
          console.log('[WebSocket] Interrupt acknowledged by backend');
          break;

        case 'error':
          this.onError?.(data.message);
          break;
      }
    } catch (error) {
      console.error('[WebSocket] Parse error:', error);
    }
  }

  sendAudioChunk(audioBase64: string) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'audio.chunk',
        audio: audioBase64
      }));
    }
  }

  stopRecording() {
    if (this.ws?.readyState === WebSocket.OPEN) {
      console.log('[WebSocket] Sending stop_recording');
      this.ws.send(JSON.stringify({ type: 'stop_recording' }));
    }
  }

  endSession() {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'session.end' }));
    }
  }

  interrupt() {
    // Stop audio playback immediately
    this.audioPlayer.stop();

    // Send interrupt signal to backend
    if (this.ws?.readyState === WebSocket.OPEN) {
      console.log('[WebSocket] Sending interrupt signal');
      this.ws.send(JSON.stringify({ type: 'interrupt' }));
    }
  }

  isPlaying(): boolean {
    return this.audioPlayer.isPlaying();
  }

  disconnect() {
    this.audioPlayer.stop();
    this.ws?.close();
    this.ws = null;
  }

  setCallbacks(callbacks: {
    onTranscriptUpdate?: (text: string, isFinal: boolean) => void;
    onTextChunk?: (text: string) => void;
    onAudioChunk?: (audio: string, index: number) => void;
    onComplete?: (text: string) => void;
    onError?: (error: string) => void;
  }) {
    this.onTranscriptUpdate = callbacks.onTranscriptUpdate;
    this.onTextChunk = callbacks.onTextChunk;
    this.onAudioChunk = callbacks.onAudioChunk;
    this.onComplete = callbacks.onComplete;
    this.onError = callbacks.onError;
  }
}
