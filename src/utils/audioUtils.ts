/**
 * AudioPlayer using Web Audio API for seamless chunk playback
 * Fixes the audio cutout issue by using proper buffering
 */
export class AudioPlayer {
  private audioContext: AudioContext | null = null;
  private queue: ArrayBuffer[] = [];
  private _isPlaying = false;
  private gainNode: GainNode | null = null;
  private nextStartTime = 0;
  private scheduledBuffers: AudioBufferSourceNode[] = [];
  private chunkBuffer: { [index: number]: AudioBuffer } = {};
  private nextChunkToPlay = 0;

  constructor() {
    // Create AudioContext on user interaction (required by browsers)
    this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    this.gainNode = this.audioContext.createGain();
    this.gainNode.connect(this.audioContext.destination);

    console.log('[AudioPlayer] Initialized with Web Audio API - seamless streaming');
  }

  async addToQueue(base64Audio: string, chunkIndex: number) {
    try {
      // Reset for new response when we get chunk #0
      if (chunkIndex === 0 && this.nextChunkToPlay !== 0) {
        console.log('[AudioPlayer] New response detected - resetting');
        this.chunkBuffer = {};
        this.nextChunkToPlay = 0;
      }

      // Convert base64 MP3 to ArrayBuffer
      const binaryString = atob(base64Audio);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      const audioData = bytes.buffer;

      // Decode MP3 to PCM using Web Audio API
      const audioBuffer = await this.audioContext!.decodeAudioData(audioData.slice(0));

      console.log(`[AudioPlayer] Decoded chunk #${chunkIndex} - Duration:`, audioBuffer.duration.toFixed(2), 's');

      // Buffer chunk and try to play in order
      this.chunkBuffer[chunkIndex] = audioBuffer;
      this.playBufferedChunks();

    } catch (error) {
      console.error('[AudioPlayer] Error decoding audio:', error);
    }
  }

  private playBufferedChunks() {
    // Play all sequential chunks that are buffered
    while (this.chunkBuffer[this.nextChunkToPlay] !== undefined) {
      const audioBuffer = this.chunkBuffer[this.nextChunkToPlay];
      delete this.chunkBuffer[this.nextChunkToPlay];

      console.log(`[AudioPlayer] Playing chunk #${this.nextChunkToPlay} in order`);
      this.schedulePlayback(audioBuffer);

      this.nextChunkToPlay++;
    }
  }

  private schedulePlayback(audioBuffer: AudioBuffer) {
    if (!this.audioContext || !this.gainNode) return;

    const source = this.audioContext.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(this.gainNode);

    const currentTime = this.audioContext.currentTime;

    // Schedule playback
    if (this.nextStartTime < currentTime) {
      // First chunk or after a gap - start immediately
      this.nextStartTime = currentTime;
    }

    source.start(this.nextStartTime);
    this._isPlaying = true; // Mark as playing

    // Update next start time for seamless playback
    this.nextStartTime += audioBuffer.duration;

    // Track scheduled buffers
    this.scheduledBuffers.push(source);

    // Cleanup when done
    source.onended = () => {
      const index = this.scheduledBuffers.indexOf(source);
      if (index > -1) {
        this.scheduledBuffers.splice(index, 1);
      }

      // If no more scheduled buffers, mark as not playing
      if (this.scheduledBuffers.length === 0) {
        this._isPlaying = false;
      }
    };

    console.log('[AudioPlayer] Scheduled chunk at:', this.nextStartTime.toFixed(2), 's');
  }

  stop() {
    // Stop all scheduled buffers
    this.scheduledBuffers.forEach(source => {
      try {
        source.stop();
      } catch (e) {
        // Ignore if already stopped
      }
    });

    this.scheduledBuffers = [];
    this.queue = [];
    this._isPlaying = false;
    this.nextStartTime = 0;
    this.chunkBuffer = {};
    this.nextChunkToPlay = 0;

    console.log('[AudioPlayer] Stopped and cleared queue');
  }

  async resume() {
    // Resume AudioContext if suspended (browser autoplay policy)
    if (this.audioContext && this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
      console.log('[AudioPlayer] AudioContext resumed');
    }
  }

  cleanup() {
    this.stop();

    if (this.gainNode) {
      this.gainNode.disconnect();
      this.gainNode = null;
    }

    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }

    console.log('[AudioPlayer] Cleaned up');
  }

  isPlaying(): boolean {
    return this._isPlaying;
  }
}

export class AudioRecorder {
  private audioContext: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private processor: ScriptProcessorNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private onChunkCallback: ((audioBase64: string) => void) | null = null;
  private onSilenceCallback: (() => void) | null = null;

  // Silence detection
  private silenceThreshold = 0.01; // Volume threshold for silence
  private silenceDuration = 300; // 300ms of silence triggers stop
  private lastSoundTime = 0;
  private silenceCheckInterval: number | null = null;

  async start(onChunk: (audioBase64: string) => void, onSilence?: () => void) {
    this.onChunkCallback = onChunk;
    this.onSilenceCallback = onSilence || null;
    this.lastSoundTime = Date.now();

    try {
      console.log('[AudioRecorder] Requesting microphone...');

      // Request microphone access
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 24000,
        }
      });

      console.log('[AudioRecorder] Microphone granted');

      // Create audio context with 24kHz sample rate (matches AssemblyAI streaming)
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: 24000
      });

      this.source = this.audioContext.createMediaStreamSource(this.mediaStream);

      // Create script processor for raw audio data (PCM16)
      const bufferSize = 4096;
      this.processor = this.audioContext.createScriptProcessor(bufferSize, 1, 1);

      this.processor.onaudioprocess = (e) => {
        if (!this.onChunkCallback) return;

        const inputData = e.inputBuffer.getChannelData(0);

        // Calculate volume (RMS) for silence detection
        let sum = 0;
        for (let i = 0; i < inputData.length; i++) {
          sum += inputData[i] * inputData[i];
        }
        const rms = Math.sqrt(sum / inputData.length);

        // Update last sound time if volume above threshold
        if (rms > this.silenceThreshold) {
          this.lastSoundTime = Date.now();
        }

        // Convert float32 to int16 (PCM16)
        const pcm16 = new Int16Array(inputData.length);
        for (let i = 0; i < inputData.length; i++) {
          const s = Math.max(-1, Math.min(1, inputData[i]));
          pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
        }

        // Convert to base64
        const bytes = new Uint8Array(pcm16.buffer);
        let binary = '';
        const chunkSize = 0x8000;
        for (let i = 0; i < bytes.length; i += chunkSize) {
          const chunk = bytes.subarray(i, Math.min(i + chunkSize, bytes.length));
          binary += String.fromCharCode(...Array.from(chunk));
        }
        const audioBase64 = btoa(binary);

        this.onChunkCallback(audioBase64);
      };

      // Start silence detection interval
      if (this.onSilenceCallback) {
        this.silenceCheckInterval = window.setInterval(() => {
          const silenceTime = Date.now() - this.lastSoundTime;
          if (silenceTime >= this.silenceDuration && this.onSilenceCallback) {
            console.log('[AudioRecorder] Silence detected, triggering callback');
            this.onSilenceCallback();
            // Reset timer to avoid repeated triggers
            this.lastSoundTime = Date.now();
          }
        }, 500); // Check every 500ms
      }

      // Connect: source -> processor -> destination
      this.source.connect(this.processor);
      this.processor.connect(this.audioContext.destination);

      console.log('[AudioRecorder] Started streaming PCM16 audio at 22.05kHz with silence detection');

    } catch (error) {
      console.error('[AudioRecorder] Error:', error);
      throw error;
    }
  }

  stop() {
    console.log('[AudioRecorder] Stopping...');

    if (this.silenceCheckInterval) {
      clearInterval(this.silenceCheckInterval);
      this.silenceCheckInterval = null;
    }

    if (this.processor) {
      this.processor.disconnect();
      this.processor = null;
    }

    if (this.source) {
      this.source.disconnect();
      this.source = null;
    }

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop());
      this.mediaStream = null;
    }

    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }

    this.onChunkCallback = null;
    this.onSilenceCallback = null;
    console.log('[AudioRecorder] Stopped');
  }

  // Allow resetting silence timer (e.g., after processing completes)
  resetSilenceTimer() {
    this.lastSoundTime = Date.now();
  }
}
