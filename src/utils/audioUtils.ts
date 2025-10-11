export class AudioRecorder {
  private audioContext: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private processor: ScriptProcessorNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private onChunkCallback: ((audioBase64: string) => void) | null = null;

  async start(onChunk: (audioBase64: string) => void) {
    this.onChunkCallback = onChunk;

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

      // Create audio context with 24kHz sample rate (matches Deepgram config)
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

      // Connect: source -> processor -> destination
      this.source.connect(this.processor);
      this.processor.connect(this.audioContext.destination);

      console.log('[AudioRecorder] Started streaming PCM16 audio at 24kHz');

    } catch (error) {
      console.error('[AudioRecorder] Error:', error);
      throw error;
    }
  }

  stop() {
    console.log('[AudioRecorder] Stopping...');

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
    console.log('[AudioRecorder] Stopped');
  }
}
