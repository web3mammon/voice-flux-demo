// Audio utilities for Deepgram STT (24kHz PCM16) and ElevenLabs TTS (MP3)

export class AudioRecorder {
  private stream: MediaStream | null = null;
  private audioContext: AudioContext | null = null;
  private processor: ScriptProcessorNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;

  constructor(private onAudioData: (audioData: string) => void) {}

  async start() {
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 24000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });

      this.audioContext = new AudioContext({
        sampleRate: 24000,
      });

      this.source = this.audioContext.createMediaStreamSource(this.stream);
      this.processor = this.audioContext.createScriptProcessor(4096, 1, 1);

      this.processor.onaudioprocess = (e) => {
        const inputData = e.inputBuffer.getChannelData(0);
        const pcm16 = this.floatTo16BitPCM(inputData);
        const base64Audio = this.arrayBufferToBase64(pcm16.buffer);
        this.onAudioData(base64Audio);
      };

      this.source.connect(this.processor);
      this.processor.connect(this.audioContext.destination);

      console.log('[AudioRecorder] Recording started - PCM16 @ 24kHz');
    } catch (error) {
      console.error('[AudioRecorder] Error accessing microphone:', error);
      throw error;
    }
  }

  private floatTo16BitPCM(float32Array: Float32Array): Int16Array {
    const int16Array = new Int16Array(float32Array.length);
    for (let i = 0; i < float32Array.length; i++) {
      const s = Math.max(-1, Math.min(1, float32Array[i]));
      int16Array[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }
    return int16Array;
  }

  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const uint8Array = new Uint8Array(buffer);
    let binary = '';
    const chunkSize = 0x8000;

    for (let i = 0; i < uint8Array.length; i += chunkSize) {
      const chunk = uint8Array.subarray(i, Math.min(i + chunkSize, uint8Array.length));
      binary += String.fromCharCode.apply(null, Array.from(chunk));
    }

    return btoa(binary);
  }

  stop() {
    if (this.source) {
      this.source.disconnect();
      this.source = null;
    }
    if (this.processor) {
      this.processor.disconnect();
      this.processor = null;
    }
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
    console.log('[AudioRecorder] Recording stopped');
  }
}

/**
 * AudioPlayer using Web Audio API for seamless chunk playback
 * Fixes the audio cutout issue by using proper buffering
 */
export class AudioPlayer {
  private audioContext: AudioContext | null = null;
  private queue: ArrayBuffer[] = [];
  private isPlaying = false;
  private gainNode: GainNode | null = null;
  private nextStartTime = 0;
  private scheduledBuffers: AudioBufferSourceNode[] = [];

  constructor() {
    // Create AudioContext on user interaction (required by browsers)
    this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    this.gainNode = this.audioContext.createGain();
    this.gainNode.connect(this.audioContext.destination);

    console.log('[AudioPlayer] Initialized with Web Audio API - seamless streaming');
  }

  async addToQueue(base64Audio: string) {
    try {
      // Convert base64 MP3 to ArrayBuffer
      const binaryString = atob(base64Audio);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      const audioData = bytes.buffer;

      // Decode MP3 to PCM using Web Audio API
      const audioBuffer = await this.audioContext!.decodeAudioData(audioData.slice(0));

      console.log('[AudioPlayer] Decoded chunk - Duration:', audioBuffer.duration.toFixed(2), 's');

      // Schedule playback immediately
      this.schedulePlayback(audioBuffer);

    } catch (error) {
      console.error('[AudioPlayer] Error decoding audio:', error);
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
    this.isPlaying = false;
    this.nextStartTime = 0;

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
}

// Legacy utility functions for compatibility
export async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        const base64 = reader.result.split(',')[1];
        resolve(base64);
      } else {
        reject(new Error('Failed to convert blob to base64'));
      }
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export function base64ToBlob(base64: string, mimeType: string): Blob {
  const byteCharacters = atob(base64);
  const byteNumbers = new Array(byteCharacters.length);

  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }

  const byteArray = new Uint8Array(byteNumbers);
  return new Blob([byteArray], { type: mimeType });
}
