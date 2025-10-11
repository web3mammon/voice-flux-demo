export class VoiceWebSocketService {
  private ws: WebSocket | null = null;
  private audioQueue: AudioChunkQueue;
  private onTranscriptUpdate?: (text: string, isFinal: boolean) => void;
  private onTextChunk?: (text: string) => void;
  private onAudioChunk?: (audio: string, index: number) => void;
  private onComplete?: (text: string) => void;
  private onError?: (error: string) => void;

  constructor() {
    this.audioQueue = new AudioChunkQueue();
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

        case 'text.chunk':
          this.onTextChunk?.(data.text);
          break;

        case 'audio.chunk':
          this.onAudioChunk?.(data.audio, data.chunk_index);
          break;

        case 'text.complete':
          this.onComplete?.(data.text);
          break;

        case 'audio.complete':
          console.log(`[WebSocket] Audio complete: ${data.total_chunks} chunks`);
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

  endSession() {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'session.end' }));
    }
  }

  disconnect() {
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

class AudioChunkQueue {
  private buffer: { [key: number]: string } = {};
  private nextToPlay = 0;
  private isPlaying = false;
  private currentAudio: HTMLAudioElement | null = null;

  async addChunk(audioBase64: string, chunkIndex: number) {
    console.log(`[AudioQueue] Adding chunk #${chunkIndex}`);
    this.buffer[chunkIndex] = audioBase64;

    if (!this.isPlaying) {
      await this.playNext();
    }
  }

  private async playNext() {
    if (!this.buffer.hasOwnProperty(this.nextToPlay)) {
      this.isPlaying = false;
      console.log(`[AudioQueue] Waiting for chunk #${this.nextToPlay}`);
      return;
    }

    this.isPlaying = true;
    const audioBase64 = this.buffer[this.nextToPlay];
    const currentChunk = this.nextToPlay;

    delete this.buffer[currentChunk];
    this.nextToPlay++;

    console.log(`[AudioQueue] Playing chunk #${currentChunk}`);

    try {
      const audioBlob = new Blob(
        [Uint8Array.from(atob(audioBase64), c => c.charCodeAt(0))],
        { type: 'audio/mpeg' }
      );
      const audioUrl = URL.createObjectURL(audioBlob);

      this.currentAudio = new Audio(audioUrl);
      await this.currentAudio.play();

      this.currentAudio.onended = () => {
        URL.revokeObjectURL(audioUrl);
        setTimeout(() => this.playNext(), 50);
      };

      this.currentAudio.onerror = (error) => {
        console.error('[AudioQueue] Playback error:', error);
        URL.revokeObjectURL(audioUrl);
        this.playNext();
      };
    } catch (error) {
      console.error('[AudioQueue] Error:', error);
      this.playNext();
    }
  }

  stop() {
    this.currentAudio?.pause();
    this.currentAudio = null;
    this.buffer = {};
    this.nextToPlay = 0;
    this.isPlaying = false;
  }
}
